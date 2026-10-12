import { NextResponse, type NextRequest } from "next/server";
import { prisma, prismaReadOnly } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/app-auth";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { ownerIdentity, textField, FORUM_LIMITS } from "@/lib/forum";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
function parseId(value: string): number | null { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; }

export async function GET(_request: NextRequest, context: Context) {
  const denied = await requireOwnerApi(); if (denied) return denied;
  const id = parseId((await context.params).id); if (!id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const post = await prismaReadOnly.forumPost.findUnique({ where: { id }, include: { author: { select: { id: true, displayName: true } }, positions: { orderBy: { displayOrder: "asc" }, include: { studyPosition: true } }, replies: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, displayName: true } } } } } });
  return post ? NextResponse.json(post) : NextResponse.json({ error: "Not found." }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireOwnerApi(); if (denied) return denied;
  if (!isGalaxyEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });
  const id = parseId((await context.params).id); const user = await ownerIdentity();
  if (!id || !user) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const existing = await prismaReadOnly.forumPost.findUnique({ where: { id }, select: { authorAppUserId: true } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (existing.authorAppUserId !== user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  let input: { title?: unknown; body?: unknown }; try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const title = textField(input.title, FORUM_LIMITS.title); const body = textField(input.body, FORUM_LIMITS.body);
  if (!title || !body) return NextResponse.json({ error: "Title and body are required." }, { status: 400 });
  await prisma.forumPost.update({ where: { id }, data: { title, body } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, context: Context) {
  const denied = await requireOwnerApi(); if (denied) return denied;
  if (!isGalaxyEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });
  const id = parseId((await context.params).id); const user = await ownerIdentity();
  if (!id || !user) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const post = await prismaReadOnly.forumPost.findUnique({ where: { id }, select: { authorAppUserId: true, positions: { select: { studyPositionId: true, studyPosition: { select: { origin: true } } } } } });
  if (!post) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (post.authorAppUserId !== user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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
