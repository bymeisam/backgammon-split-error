import { NextResponse, type NextRequest } from "next/server";
import { prismaApp, prismaReadOnly } from "@/lib/prisma";
import { requireMemberApi } from "@/lib/app-auth";
import { isAppWriteEnabled } from "@/lib/appWriteGate";
import { forumIdentity, parseId, textField } from "@/lib/forum";
import { validateReplyProposals } from "@/lib/forumProposalInput";

type Context = { params: Promise<{ id: string }> };
// POST /api/forum/posts/[id]/replies creates a member reply with optional
// position proposals; all writes are gated by ENABLE_WRITE_MODE.

// POST /api/forum/posts/[id]/replies   body: { body?, proposals? }
//
// Adds a reply to a post, as the signed-in member or owner. Write mode only
// (isAppWriteEnabled(), the same gate as every other in-app write).
export async function POST(request: NextRequest, context: Context) {
  const denied = await requireMemberApi();
  if (denied) return denied;
  if (!isAppWriteEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });

  const postId = parseId((await context.params).id);
  const user = await forumIdentity();
  if (!postId || !user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const post = await prismaReadOnly.forumPost.findUnique({
    where: { id: postId },
    select: { id: true, positions: { select: { studyPositionId: true, studyPosition: { select: { id: true, positionId: true, gnuMatchId: true, kind: true } } } } },
  });
  if (!post) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let input: { body?: unknown; proposals?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Invalid reply." }, { status: 400 });
  const body = textField(input.body, 20_000) ?? "";
  const proposals = validateReplyProposals(input.proposals ?? [], post.positions);
  if (!proposals) return NextResponse.json({ error: "Invalid proposal." }, { status: 400 });
  if (!body && proposals.length === 0) return NextResponse.json({ error: "Reply text or a proposal is required." }, { status: 400 });

  const reply = await prismaApp.$transaction(async (tx) => {
    const created = await tx.forumReply.create({ data: { postId, authorAppUserId: user.id, body } });
    if (proposals.length) await tx.forumMoveProposal.createMany({ data: proposals.map((proposal) => ({ ...proposal, replyId: created.id })) });
    return created;
  });
  return NextResponse.json({ id: reply.id }, { status: 201 });
}
