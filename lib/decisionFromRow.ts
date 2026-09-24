// Builds a lib/mistakes.ts `Decision` (the exact shape BoardPanel already
// consumes, reused unmodified) directly from one already-ingested Decision
// DB row — no live Galaxy call, no surrounding game context needed. Each
// row is self-contained: its own `raw` JSON column holds the full original
// event (including reviews[0]), so the same label-derivation logic
// lib/mistakes.ts already uses for a live game_reviews fetch applies here
// unchanged, just reused via its exported actionLabels/moveNotations.
//
// Server-only (imports the Prisma-generated enum types) — never import this
// from a "use client" file; pass the resulting plain Decision objects down
// as props instead, the way app/mistakes/page.tsx does.
import type {
  DecisionKind as PrismaDecisionKind,
  ErrorSeverity as PrismaErrorSeverity,
} from "@/lib/generated/prisma/client";
import type { GameEvent } from "@/lib/gameReviewsTypes";
import {
  actionLabels,
  findPrecedingRoll,
  moveNotations,
  type Decision,
  type DecisionKind,
  type Severity,
} from "@/lib/mistakes";

const KIND_MAP: Record<PrismaDecisionKind, DecisionKind> = {
  CHECKER: "checker",
  CUBE: "cube",
  RESIGNATION: "resignation",
};

// DOUBTFUL is Galaxy's mildest graded-mistake tier. lib/mistakes.ts's own
// Severity type only has "error" | "blunder" (it computes severity from a
// threshold on absError, not from Galaxy's own classification at all) — and
// BoardPanel (reused exactly as-is here) only branches on
// `=== "blunder"` vs anything else, so DOUBTFUL maps to the closest
// existing bucket ("error") rather than extending that type. NONE means no
// real mistake, mapped to null to match lib/mistakes.ts's own convention
// for a clean decision.
function severityFor(severity: PrismaErrorSeverity): Severity | null {
  switch (severity) {
    case "BLUNDER":
      return "blunder";
    case "ERROR":
    case "DOUBTFUL":
      return "error";
    case "NONE":
      return null;
  }
}

export interface DecisionRow {
  id: number;
  gameId: number;
  eventId: bigint;
  userId: string;
  color: string;
  kind: PrismaDecisionKind;
  rawError: number | null;
  errorSeverity: PrismaErrorSeverity;
  raw: unknown;
  game: { gameIndex: number };
}

// Galaxy analyses a dice_rolled event too (as a "should you have doubled
// before this roll" cube check — kind: CUBE, often countAsDecision: false),
// so it's stored as its own sibling Decision row in the same game, carrying
// rolled_dice at its raw JSON's top level. A checker decision's own
// move_commited event never carries its own roll — the caller must fetch
// every Decision row for the games it's displaying (not just the
// countAsDecision: true ones /mistakes normally queries) and build this
// lookup from them, keyed by "gameId:eventId", before calling
// decisionFromRow. Mirrors lib/mistakes.ts's own live-fetch extraction
// (which always has the full event list already), just narrowed to
// whichever games are actually on the current page.
export function buildRollLookup(
  gameRows: { gameId: number; eventId: bigint; raw: unknown }[]
): Map<string, number[]> {
  const byGame = new Map<number, { eventId: bigint; event: GameEvent }[]>();
  for (const row of gameRows) {
    const list = byGame.get(row.gameId) ?? [];
    list.push({ eventId: row.eventId, event: row.raw as unknown as GameEvent });
    byGame.set(row.gameId, list);
  }

  const lookup = new Map<string, number[]>();
  for (const [gameId, rows] of byGame) {
    rows.sort((a, b) => (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0));
    const events = rows.map((r) => r.event);
    rows.forEach((r, index) => {
      lookup.set(`${gameId}:${r.eventId}`, findPrecedingRoll(events, index));
    });
  }
  return lookup;
}

// Returns null for a row with no usable data (rawError null, or somehow no
// reviews[0] in its own raw JSON) — same "ungraded, skip it" treatment
// lib/mistakes.ts's own extractDecisions gives a null rawError, rather than
// crashing or faking a zero. `rollLookup` is optional so callers that don't
// care about dice (or haven't fetched the sibling rows) can omit it and get
// an empty roll, same as before.
export function decisionFromRow(row: DecisionRow, rollLookup?: Map<string, number[]>): Decision | null {
  if (row.rawError === null) return null;

  const event = row.raw as unknown as GameEvent;
  const review = event.reviews?.[0];
  if (!review) return null;

  const { mine, best } = actionLabels(review);
  const { mine: myMoveNotation, best: bestMoveNotation } = moveNotations(review);
  const absError = Math.abs(row.rawError);

  return {
    id: String(row.id),
    gameIndex: row.game.gameIndex,
    userId: row.userId,
    color: row.color,
    kind: KIND_MAP[row.kind],
    absError,
    isMistake: absError > 0,
    severity: severityFor(row.errorSeverity),
    detail:
      review.result.analysed_event === "move"
        ? `played ${mine} → best ${best}`
        : `${mine} → best: ${best}`,
    myLabel: mine,
    bestLabel: best,
    roll: rollLookup?.get(`${row.gameId}:${row.eventId}`) ?? event.rolled_dice ?? [],
    sourcePositionId: review.source_position?.formatted_value ?? null,
    myMoveNotation,
    bestMoveNotation,
  };
}
