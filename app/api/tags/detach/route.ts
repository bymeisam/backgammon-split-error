import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { positiveId, readJsonObject } from "@/lib/review/requests";

export const dynamic = "force-dynamic";

// POST /api/tags/detach   body: { "decisionId": number, "tagId": number }
//
// Removes a tag from a decision. The tag itself stays (it keeps feeding the
// autocomplete). Removing a tag the decision doesn't have is a no-op.
// 400 bad input.
//
// Read-write client. Gated by proxy.ts (/api/tags/:path*).
export async function POST(req: Request) {
  const body = await readJsonObject(req);
  const decisionId = positiveId(body?.decisionId);
  const tagId = positiveId(body?.tagId);
  if (decisionId === null || tagId === null) {
    return NextResponse.json(
      { error: "Body must be JSON: { \"decisionId\": positive integer, \"tagId\": positive integer }." },
      { status: 400 }
    );
  }
  const removed = await prisma.decisionTag.deleteMany({ where: { decisionId, tagId } });
  return NextResponse.json({ removed: removed.count });
}
