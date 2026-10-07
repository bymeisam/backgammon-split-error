import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { positiveId, readJsonObject } from "@/lib/review/requests";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/review/cards/[id]   body: { "suspended": boolean }
// Suspends (takes out of the queue, keeping its schedule and history) or
// unsuspends a card.
//
// DELETE /api/review/cards/[id]
// Deletes the card and, by the FK's ON DELETE CASCADE, its ReviewLog
// history. The decision, its note and its tags stay.
//
// Read-write client. Gated by proxy.ts (/api/review/:path*).
export async function PATCH(req: Request, { params }: Params) {
  const id = positiveId((await params).id);
  if (id === null) return NextResponse.json({ error: "Card id must be a positive integer." }, { status: 400 });
  const body = await readJsonObject(req);
  if (typeof body?.suspended !== "boolean") {
    return NextResponse.json({ error: "Body must be JSON: { \"suspended\": boolean }." }, { status: 400 });
  }
  const updated = await prisma.reviewCard.updateMany({ where: { id }, data: { suspended: body.suspended } });
  if (updated.count === 0) return NextResponse.json({ error: `Card ${id} doesn't exist.` }, { status: 404 });
  return NextResponse.json({ cardId: id, suspended: body.suspended });
}

export async function DELETE(_req: Request, { params }: Params) {
  const id = positiveId((await params).id);
  if (id === null) return NextResponse.json({ error: "Card id must be a positive integer." }, { status: 400 });
  const deleted = await prisma.reviewCard.deleteMany({ where: { id } });
  if (deleted.count === 0) return NextResponse.json({ error: `Card ${id} doesn't exist.` }, { status: 404 });
  return NextResponse.json({ cardId: id, deleted: true });
}
