import { NextResponse, type NextRequest } from "next/server";
import { prisma, prismaReadOnly } from "@/lib/prisma";
import { requireMemberApi } from "@/lib/app-auth";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { forumIdentity, optionalBoolean, parseId, textField, FORUM_LIMITS } from "@/lib/forum";
import { canDeleteForumItem, canEditForumItem } from "@/lib/forumPermissions";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

// GET /api/forum/posts/[id]
//
// One post with its attached positions (in display order) and its replies
// (oldest first). Members and the owner; a read, so it isn't behind the write gate.
export async function GET(_request: NextRequest, context: Context) {
  const denied = await requireMemberApi();
  if (denied) return denied;

  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const post = await prismaReadOnly.forumPost.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, displayName: true } },
      positions: { orderBy: { displayOrder: "asc" }, include: { studyPosition: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, displayName: true } } },
      },
    },
  });
  return post ? NextResponse.json(post) : NextResponse.json({ error: "Not found." }, { status: 404 });
}

// PATCH /api/forum/posts/[id]   body: { "title": string, "body": string,
//                                     "hideAnalysis"?: boolean }
//
// Edits a post's title and body, and its hideAnalysis flag when given (left
// as it is when absent). Only its author may, and only with write
// mode on (isGalaxyEnabled(), the same gate as every other write).
export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireMemberApi();
  if (denied) return denied;
  if (!isGalaxyEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });

  const id = parseId((await context.params).id);
  const user = await forumIdentity();
  if (!id || !user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const existing = await prismaReadOnly.forumPost.findUnique({ where: { id }, select: { authorAppUserId: true } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canEditForumItem(user, existing.authorAppUserId)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  let input: { title?: unknown; body?: unknown; hideAnalysis?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const title = textField(input.title, FORUM_LIMITS.title);
  const body = textField(input.body, FORUM_LIMITS.body);
  if (!title || !body) return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  const hideAnalysis = optionalBoolean(input.hideAnalysis);
  if (hideAnalysis === "invalid") return NextResponse.json({ error: "hideAnalysis must be a boolean." }, { status: 400 });

  await prisma.forumPost.update({
    where: { id },
    data: { title, body, ...(hideAnalysis === "absent" ? {} : { hideAnalysis }) },
  });
  return NextResponse.json({ ok: true });
}

// DELETE /api/forum/posts/[id]
//
// Deletes a post (its replies and attachments cascade). Its author may, or
// the owner on anyone's post (moderation; lib/forumPermissions.ts). A manually built
// StudyPosition left with no other post goes too; one taken from a match
// decision is kept.
export async function DELETE(_request: NextRequest, context: Context) {
  const denied = await requireMemberApi();
  if (denied) return denied;
  if (!isGalaxyEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });

  const id = parseId((await context.params).id);
  const user = await forumIdentity();
  if (!id || !user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const post = await prismaReadOnly.forumPost.findUnique({
    where: { id },
    select: {
      authorAppUserId: true,
      positions: { select: { studyPositionId: true, studyPosition: { select: { origin: true } } } },
    },
  });
  if (!post) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!canDeleteForumItem(user, post.authorAppUserId)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  await prisma.$transaction(async (tx) => {
    await tx.forumPost.delete({ where: { id } });
    for (const attachment of post.positions) {
      if (attachment.studyPosition.origin === "MANUAL") {
        const count = await tx.forumPostPosition.count({ where: { studyPositionId: attachment.studyPositionId } });
        if (count === 0) await tx.studyPosition.delete({ where: { id: attachment.studyPositionId } });
      }
    }
  });
  return new NextResponse(null, { status: 204 });
}
