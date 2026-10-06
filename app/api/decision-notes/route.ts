import { NextResponse, type NextRequest } from "next/server";
import { prismaReadOnly } from "@/lib/prisma";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import type { MatchDecisionNotesResponse } from "@/lib/decisionNotes";

export const dynamic = "force-dynamic";

// Same "galaxy" source tag every DB read path resolves a Match by —
// /matches/[matchId] uses Galaxy's own match id in its URL, which is exactly
// what ingest stores as Match.sourceMatchId (String(matchId), see
// docs/field-mapping.md). Its only caller is /matches/[matchId]:
// /galaxy/matches/[matchId] shows live Galaxy data, is read-only, and never
// fetches notes.
const SOURCE = "galaxy";

// GET /api/decision-notes?matchId=<Galaxy match id>
//
// The live path's note lookup (MistakesSection, a client component, builds
// its decisions from game payloads with no DB ids). One read-only query per
// match: every Decision of the match (resolved via Match (source,
// sourceMatchId) -> Game -> Decision) with its id, natural key and note, so
// the client can attach note + dbDecisionId by (gameIndex, eventId) — see
// lib/decisionNotes.ts's attachNotes. Not gated by proxy.ts: it only reads,
// through prismaReadOnly, same as /api/matches/*. canEdit tells the client
// whether the (gated) save route is reachable.
export async function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get("matchId");
  if (!matchId) {
    return NextResponse.json({ error: "matchId is required." }, { status: 400 });
  }

  const rows = await prismaReadOnly.decision.findMany({
    where: { game: { match: { source: SOURCE, sourceMatchId: matchId } } },
    select: {
      id: true,
      eventId: true,
      game: { select: { gameIndex: true } },
      note: { select: { note: true } },
    },
  });

  const body: MatchDecisionNotesResponse = {
    canEdit: isGalaxyEnabled(),
    decisions: rows.map((row) => ({
      gameIndex: row.game.gameIndex,
      eventId: row.eventId.toString(),
      dbDecisionId: row.id,
      note: row.note?.note ?? null,
    })),
  };
  return NextResponse.json(body);
}
