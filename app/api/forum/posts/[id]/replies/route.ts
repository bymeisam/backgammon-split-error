import { NextResponse, type NextRequest } from "next/server";
import { prismaForum, prismaReadOnly } from "@/lib/prisma";
import { requireMemberApi } from "@/lib/app-auth";
import { isForumWriteEnabled } from "@/lib/forumGate";
import { forumIdentity, parseId, textField } from "@/lib/forum";

type Context = { params: Promise<{ id: string }> };

// POST /api/forum/posts/[id]/replies   body: { "body": string }
//
// Adds a reply to a post, as the signed-in member or owner. Write mode only
// (isForumWriteEnabled(), the same gate as every other write).
export async function POST(request: NextRequest, context: Context) {
  const denied = await requireMemberApi();
  if (denied) return denied;
  if (!isForumWriteEnabled()) return NextResponse.json({ error: "Writes are disabled." }, { status: 403 });

  const postId = parseId((await context.params).id);
  const user = await forumIdentity();
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

  const reply = await prismaForum.forumReply.create({ data: { postId, authorAppUserId: user.id, body } });
  return NextResponse.json({ id: reply.id }, { status: 201 });
}
