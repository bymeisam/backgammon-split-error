import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isUniqueViolation } from "@/lib/review/db";
import { positiveId, readJsonObject } from "@/lib/review/requests";
import { normalizeTagName } from "@/lib/review/tags";

export const dynamic = "force-dynamic";

// POST /api/tags/attach   body: { "decisionId": number, "name": string }
//
// Puts a tag on a decision, creating the tag if it's new. The name is
// trimmed (lib/review/tags.ts); an existing tag is matched by the DB's
// case-insensitive collation, so "Prime" reuses "prime". Attaching a tag the
// decision already has is a no-op. 400 bad input, 404 no such decision.
//
// Read-write client. Gated by proxy.ts (/api/tags/:path*).
export async function POST(req: Request) {
  const body = await readJsonObject(req);
  const decisionId = positiveId(body?.decisionId);
  if (decisionId === null) {
    return NextResponse.json({ error: "Body must be JSON: { \"decisionId\": positive integer, \"name\": string }." }, { status: 400 });
  }
  const name = normalizeTagName(body?.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });

  const decision = await prisma.decision.findUnique({ where: { id: decisionId }, select: { id: true } });
  if (!decision) return NextResponse.json({ error: `Decision ${decisionId} doesn't exist.` }, { status: 404 });

  let tag = await prisma.tag.findUnique({ where: { name: name.name }, select: { id: true, name: true } });
  if (!tag) {
    try {
      tag = await prisma.tag.create({ data: { name: name.name }, select: { id: true, name: true } });
    } catch (err) {
      // Created by a concurrent request (or differs only in case): reuse it.
      if (!isUniqueViolation(err)) throw err;
      tag = await prisma.tag.findUnique({ where: { name: name.name }, select: { id: true, name: true } });
      if (!tag) throw err;
    }
  }

  await prisma.decisionTag.createMany({ data: [{ decisionId, tagId: tag.id }], skipDuplicates: true });
  return NextResponse.json({ tag });
}
