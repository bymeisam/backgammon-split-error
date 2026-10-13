import { NextResponse, type NextRequest } from "next/server";
import { prisma, prismaReadOnly } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/app-auth";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import { ownerIdentity, textField } from "@/lib/forum";

type Context = { params: Promise<{ id: string }> };

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// PATCH /api/forum/replies/[id]   body: { "body": string }
//
// Edits a reply's body. Only its author may, and only with write mode on
// (isGalaxyEnabled(), the same gate as every other write).
export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  if (!isGalaxyEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });

  const id = parseId((await context.params).id);
  const user = await ownerIdentity();
  if (!id || !user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const reply = await prismaReadOnly.forumReply.findUnique({ where: { id }, select: { authorAppUserId: true } });
  if (!reply) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (reply.authorAppUserId !== user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  let input: { body?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const body = textField(input.body, 20_000);
  if (!body) return NextResponse.json({ error: "Reply body is required." }, { status: 400 });

  await prisma.forumReply.update({ where: { id }, data: { body } });
  return NextResponse.json({ ok: true });
}

// DELETE /api/forum/replies/[id]
//
// Deletes a reply. Same author and write-mode checks as PATCH.
export async function DELETE(_request: NextRequest, context: Context) {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  if (!isGalaxyEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });

  const id = parseId((await context.params).id);
  const user = await ownerIdentity();
  if (!id || !user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const reply = await prismaReadOnly.forumReply.findUnique({ where: { id }, select: { authorAppUserId: true } });
  if (!reply) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (reply.authorAppUserId !== user.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  await prisma.forumReply.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
