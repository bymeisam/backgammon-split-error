import { NextRequest, NextResponse } from "next/server";
import { prismaReadOnly as prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Read-only; no auth needed — checks which of a given set of Galaxy
// sourceMatchIds are already fully ingested (ingestStatus: DONE) here, so
// /galaxy/matches can hide/disable the per-row Sync button for matches that
// don't need it. One batched IN query for the whole list passed in (a
// single Galaxy page's worth, ~30 ids), never N individual per-match
// lookups. A match that's merely index-synced (PENDING/INGESTING/FAILED)
// isn't "done" yet, so it's deliberately excluded here and still needs Sync.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("matchIds") ?? "";
  const matchIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (matchIds.length === 0) {
    return NextResponse.json({ done: [] });
  }

  const rows = await prisma.match.findMany({
    where: { sourceMatchId: { in: matchIds }, ingestStatus: "DONE" },
    select: { sourceMatchId: true },
  });

  return NextResponse.json({ done: rows.map((r) => r.sourceMatchId) });
}
