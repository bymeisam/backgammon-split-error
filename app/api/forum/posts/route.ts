import { NextResponse, type NextRequest } from "next/server";
import { prisma, prismaReadOnly } from "@/lib/prisma";
import { requireMemberApi } from "@/lib/app-auth";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { FORUM_LIMITS, forumIdentity, rawMatchId, sourceDecision, textField, validIds } from "@/lib/forum";
import { decodeGnuMatchId } from "@/lib/gnuMatchId";

export const dynamic = "force-dynamic";

// GET /api/forum/posts
//
// Every post, newest first, with its author, attachments and counts.
// Members and the owner; a read, so it isn't behind the write gate.
export async function GET() {
  const denied = await requireMemberApi();
  if (denied) return denied;

  const posts = await prismaReadOnly.forumPost.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { displayName: true } },
      positions: true,
      _count: { select: { replies: true, positions: true } },
    },
  });
  return NextResponse.json(posts);
}

type ResolvedPosition = {
  positionId: string;
  gnuMatchId: string;
  kind: "CHECKER" | "CUBE";
  sourceDecisionId?: number;
  origin: "MANUAL" | "MATCH_DECISION";
};

type PositionInput = {
  manual?: { positionId?: unknown; gnuMatchId?: unknown; kind?: unknown };
  match?: { decisionId?: unknown };
};

// Turns one attachment from the request into the StudyPosition to create.
// An attachment is either manual (GNU Position ID, GNU Match ID and kind,
// e.g. from the position builder) or a match decision, whose IDs are read
// from the stored Decision: sourcePositionId, and the GNU Match ID from raw
// (lib/forum.ts rawMatchId).
async function resolvePosition(input: unknown): Promise<{ position: ResolvedPosition } | { error: string; status: number }> {
  if (typeof input !== "object" || input === null) {
    return { error: "Invalid position attachment.", status: 400 };
  }

  const candidate = input as PositionInput;
  const hasManual = candidate.manual !== undefined;
  const hasMatch = candidate.match !== undefined;
  if (hasManual === hasMatch) {
    return { error: "Each attachment must choose exactly one position source.", status: 400 };
  }

  if (hasManual) {
    const manual = candidate.manual!;
    const kind = manual.kind === "CHECKER" || manual.kind === "CUBE" ? manual.kind : null;
    if (!validIds(manual.positionId, manual.gnuMatchId) || !kind) {
      return { error: "Invalid GNU position, match ID, or kind.", status: 400 };
    }
    return {
      position: {
        positionId: manual.positionId,
        gnuMatchId: manual.gnuMatchId as string,
        kind,
        origin: "MANUAL",
      },
    };
  }

  const decisionId = candidate.match?.decisionId;
  if (typeof decisionId !== "number" || !Number.isInteger(decisionId) || decisionId < 1) {
    return { error: "Invalid decision ID.", status: 400 };
  }
  const decision = await sourceDecision(decisionId);
  if (!decision || !decision.sourcePositionId) {
    return { error: "Decision not found or lacks a position.", status: 404 };
  }
  const gnuMatchId = rawMatchId(decision.raw);
  if (!gnuMatchId || !decodeGnuMatchId(gnuMatchId)) {
    return { error: "Decision lacks a valid GNU Match ID.", status: 409 };
  }
  const kind = decision.kind === "CHECKER" || decision.kind === "CUBE" ? decision.kind : null;
  if (!kind || !validIds(decision.sourcePositionId, gnuMatchId)) {
    return { error: "Decision source identifiers are invalid.", status: 409 };
  }
  return {
    position: {
      positionId: decision.sourcePositionId,
      gnuMatchId,
      kind,
      sourceDecisionId: decision.id,
      origin: "MATCH_DECISION",
    },
  };
}

// POST /api/forum/posts   body: { "title": string, "body": string,
//                                 "positions": attachment[] }
//
// Creates a post with 1 to FORUM_LIMITS.positions attached positions, as the
// signed-in member or owner. Write mode only (isGalaxyEnabled(), the same gate as every
// other write). The post, its StudyPositions and the attachment rows are
// created in one transaction.
export async function POST(request: NextRequest) {
  const denied = await requireMemberApi();
  if (denied) return denied;
  if (!isGalaxyEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });

  const user = await forumIdentity();
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const input = payload as { title?: unknown; body?: unknown; positions?: unknown };
  const title = textField(input.title, FORUM_LIMITS.title);
  const body = textField(input.body, FORUM_LIMITS.body);
  if (!title || !body) return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  if (
    !Array.isArray(input.positions) ||
    input.positions.length === 0 ||
    input.positions.length > FORUM_LIMITS.positions
  ) {
    return NextResponse.json(
      { error: `Add between 1 and ${FORUM_LIMITS.positions} position attachments.` },
      { status: 400 }
    );
  }

  // Resolve every attachment before writing anything, so one bad attachment
  // fails the whole request.
  const positions: ResolvedPosition[] = [];
  for (const attachment of input.positions) {
    const resolved = await resolvePosition(attachment);
    if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    positions.push(resolved.position);
  }

  const post = await prisma.$transaction(async (tx) => {
    const createdPost = await tx.forumPost.create({ data: { authorAppUserId: user.id, title, body } });

    // One new StudyPosition per attachment, linked in the order given.
    for (const [displayOrder, position] of positions.entries()) {
      const study = await tx.studyPosition.create({
        data: {
          createdByAppUserId: user.id,
          origin: position.origin,
          positionId: position.positionId,
          gnuMatchId: position.gnuMatchId,
          kind: position.kind,
          sourceDecisionId: position.sourceDecisionId,
        },
      });
      await tx.forumPostPosition.create({ data: { postId: createdPost.id, studyPositionId: study.id, displayOrder } });
    }
    return createdPost;
  });

  return NextResponse.json({ id: post.id }, { status: 201 });
}
