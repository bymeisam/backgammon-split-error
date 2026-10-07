import { NextResponse, type NextRequest } from "next/server";
import { prismaReadOnly } from "@/lib/prisma";
import { isGalaxyEnabled } from "@/lib/galaxyGate";
import type { MatchDecisionNotesResponse } from "@/lib/decisionNotes";
import { isReviewEligible } from "@/lib/review/eligibility";

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
// (Named for notes, its first use; since 2026-10-07 it also returns each
// decision's tags, and with write mode on its review card and eligibility,
// for the review controls on /matches/[matchId]'s board.)
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

  const canEdit = isGalaxyEnabled();
  const rows = await prismaReadOnly.decision.findMany({
    where: { game: { match: { source: SOURCE, sourceMatchId: matchId } } },
    select: {
      id: true,
      eventId: true,
      game: { select: { gameIndex: true } },
      note: { select: { note: true } },
      // Tags show read-only too, so they're always read.
      tags: { select: { tag: { select: { id: true, name: true } } }, orderBy: { tag: { name: "asc" } } },
    },
  });

  // Review status and eligibility only matter where the review controls
  // show, i.e. with write mode on (the live read-only site hides them), so
  // only then are the cards and the counted decisions' raw read: raw for
  // the eligibility rule (lib/review/eligibility.ts), counted checker/cube
  // decisions only (the only ones that can be eligible).
  const review = new Map<number, { card: { id: number; due: Date; suspended: boolean } | null; eligible: boolean }>();
  if (canEdit) {
    const counted = await prismaReadOnly.decision.findMany({
      where: {
        game: { match: { source: SOURCE, sourceMatchId: matchId } },
        countAsDecision: true,
        rawError: { not: null },
        kind: { in: ["CHECKER", "CUBE"] },
      },
      select: {
        id: true,
        kind: true,
        countAsDecision: true,
        rawError: true,
        raw: true,
        game: { select: { match: { select: { source: true } } } },
        reviewCard: { select: { id: true, due: true, suspended: true } },
      },
    });
    for (const d of counted) {
      review.set(d.id, {
        card: d.reviewCard,
        eligible: isReviewEligible({
          kind: d.kind,
          countAsDecision: d.countAsDecision,
          rawError: d.rawError,
          source: d.game.match.source,
          raw: d.raw,
        }),
      });
    }
  }

  const body: MatchDecisionNotesResponse = {
    canEdit,
    decisions: rows.map((row) => {
      const r = review.get(row.id);
      return {
        gameIndex: row.game.gameIndex,
        eventId: row.eventId.toString(),
        dbDecisionId: row.id,
        note: row.note?.note ?? null,
        tags: row.tags.map((t) => t.tag),
        reviewCard: r?.card
          ? { cardId: r.card.id, due: r.card.due.toISOString(), suspended: r.card.suspended }
          : null,
        reviewEligible: r?.eligible ?? false,
      };
    }),
  };
  return NextResponse.json(body);
}
