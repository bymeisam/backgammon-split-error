import { NextResponse, type NextRequest } from "next/server";
import { prisma, prismaReadOnly } from "@/lib/prisma";
import { requireMemberApi } from "@/lib/app-auth";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { forumIdentity, parseId, textField } from "@/lib/forum";
import { validateReplyProposals } from "@/lib/forumProposalInput";
import { canDeleteForumItem, canEditForumItem } from "@/lib/forumPermissions";

type Context = { params: Promise<{ id: string }> };

// PATCH /api/forum/replies/[id]   body: { "body": string }
//
// Edits a reply's body. Only its author may, and only with write mode on
// (isGalaxyEnabled(), the same gate as every other write).
export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireMemberApi();
  if (denied) return denied;
  if (!isGalaxyEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });

  const id = parseId((await context.params).id);
  const user = await forumIdentity();
  if (!id || !user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const reply = await prismaReadOnly.forumReply.findUnique({
    where: { id },
    select: { postId: true, authorAppUserId: true, proposals: { select: { id: true } }, post: { select: { positions: { select: { studyPositionId: true, studyPosition: { select: { id: true, positionId: true, gnuMatchId: true, kind: true } } } } } } },
  });
  if (!reply) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canEditForumItem(user, reply.authorAppUserId)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  let input: { body?: unknown; proposals?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Invalid reply." }, { status: 400 });
  const body = textField(input.body, 20_000) ?? "";
  const hasProposals = Object.hasOwn(input, "proposals");
  const proposals = hasProposals ? validateReplyProposals(input.proposals, reply.post.positions) : [];
  if (!proposals) return NextResponse.json({ error: "Invalid proposal." }, { status: 400 });
  if (!body && proposals.length === 0 && (hasProposals || reply.proposals.length === 0)) {
    return NextResponse.json({ error: "Reply text or a proposal is required." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.forumReply.update({ where: { id }, data: { body } });
    if (hasProposals) {
      await tx.forumMoveProposal.deleteMany({ where: { replyId: id } });
      if (proposals.length) await tx.forumMoveProposal.createMany({ data: proposals.map((proposal) => ({ ...proposal, replyId: id })) });
    }
  });
  return NextResponse.json({ ok: true });
}

// DELETE /api/forum/replies/[id]
//
// Deletes a reply. Its author may, or the owner on anyone's reply
// (moderation; lib/forumPermissions.ts). Write mode only, as PATCH.
export async function DELETE(_request: NextRequest, context: Context) {
  const denied = await requireMemberApi();
  if (denied) return denied;
  if (!isGalaxyEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });

  const id = parseId((await context.params).id);
  const user = await forumIdentity();
  if (!id || !user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const reply = await prismaReadOnly.forumReply.findUnique({ where: { id }, select: { authorAppUserId: true } });
  if (!reply) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canDeleteForumItem(user, reply.authorAppUserId)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  await prisma.forumReply.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
