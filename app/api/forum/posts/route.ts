import { NextResponse, type NextRequest } from "next/server";
import { prisma, prismaReadOnly } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/app-auth";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { FORUM_LIMITS, ownerIdentity, rawMatchId, sourceDecision, textField, validIds } from "@/lib/forum";
import { decodeGnuMatchId } from "@/lib/gnuMatchId";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  const posts = await prismaReadOnly.forumPost.findMany({
    orderBy: { createdAt: "desc" },
    include: { author: { select: { displayName: true } }, positions: true, _count: { select: { replies: true, positions: true } } },
  });
  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  if (!isGalaxyEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });
  const user = await ownerIdentity();
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const input = payload as { title?: unknown; body?: unknown; manual?: { positionId?: unknown; gnuMatchId?: unknown; kind?: unknown }; match?: { decisionId?: unknown } };
  const title = textField(input.title, FORUM_LIMITS.title);
  const body = textField(input.body, FORUM_LIMITS.body);
  if (!title || !body) return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  const hasManual = input.manual !== undefined;
  const hasMatch = input.match !== undefined;
  if (hasManual === hasMatch) return NextResponse.json({ error: "Choose one position source." }, { status: 400 });

  let position: { positionId: string; gnuMatchId: string; kind: "CHECKER" | "CUBE"; sourceDecisionId?: number; origin: "MANUAL" | "MATCH_DECISION" };
  if (hasManual) {
    const manual = input.manual!;
    const manualKind = manual.kind === "CHECKER" || manual.kind === "CUBE" ? manual.kind : null;
    if (!validIds(manual.positionId, manual.gnuMatchId) || !manualKind) {
      return NextResponse.json({ error: "Invalid GNU position, match ID, or kind." }, { status: 400 });
    }
    position = { positionId: manual.positionId as string, gnuMatchId: manual.gnuMatchId as string, kind: manualKind, origin: "MANUAL" };
  } else {
    const decisionId = input.match?.decisionId;
    if (typeof decisionId !== "number" || !Number.isInteger(decisionId) || decisionId < 1) return NextResponse.json({ error: "Invalid decision ID." }, { status: 400 });
    const decision = await sourceDecision(decisionId);
    if (!decision || !decision.sourcePositionId) return NextResponse.json({ error: "Decision not found or lacks a position." }, { status: 404 });
    const gnuMatchId = rawMatchId(decision.raw);
    if (!gnuMatchId || !decodeGnuMatchId(gnuMatchId)) return NextResponse.json({ error: "Decision lacks a valid GNU Match ID." }, { status: 409 });
    const kind = decision.kind === "CHECKER" || decision.kind === "CUBE" ? decision.kind : null;
    if (!kind || !validIds(decision.sourcePositionId, gnuMatchId)) return NextResponse.json({ error: "Decision source identifiers are invalid." }, { status: 409 });
    position = { positionId: decision.sourcePositionId, gnuMatchId, kind, sourceDecisionId: decision.id, origin: "MATCH_DECISION" };
  }

  const post = await prisma.$transaction(async (tx) => {
    const study = await tx.studyPosition.create({ data: { createdByAppUserId: user.id, origin: position.origin, positionId: position.positionId, gnuMatchId: position.gnuMatchId, kind: position.kind, sourceDecisionId: position.sourceDecisionId } });
    return tx.forumPost.create({ data: { authorAppUserId: user.id, title, body, positions: { create: { studyPositionId: study.id, displayOrder: 0 } } }, include: { positions: true } });
  });
  return NextResponse.json({ id: post.id }, { status: 201 });
}
