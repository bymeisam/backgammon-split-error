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

// POST /api/forum/posts/[id]/replies   body: { "body": string }
//
// Adds a reply to a post, as the signed-in owner. Write mode only
// (isGalaxyEnabled(), the same gate as every other write).
export async function POST(request: NextRequest, context: Context) {
  const denied = await requireOwnerApi();
  if (denied) return denied;
  if (!isGalaxyEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });

  const postId = parseId((await context.params).id);
  const user = await ownerIdentity();
  if (!postId || !user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const post = await prismaReadOnly.forumPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let input: { body?: unknown };
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const body = textField(input.body, 20_000);
  if (!body) return NextResponse.json({ error: "Reply body is required." }, { status: 400 });

  const reply = await prisma.forumReply.create({ data: { postId, authorAppUserId: user.id, body } });
  return NextResponse.json({ id: reply.id }, { status: 201 });
}
