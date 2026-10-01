// Builds a lib/mistakes.ts `Decision` (the shape BoardPanel consumes)
// directly from one already-ingested Decision
// DB row — no live Galaxy call, no surrounding game context needed. Each
// row is self-contained: its own `raw` JSON column holds the full original
// event (including reviews[0]), so the same label-derivation logic
// lib/mistakes.ts already uses for a live game_reviews fetch applies here
// unchanged for myLabel/bestLabel (via actionLabels) — but myMoveNotation/
// bestMoveNotation read the row's own notationPlayed/notationBest columns
// directly rather than re-parsing raw via moveNotations(), since ingest
// already stores exactly this (confirmed byte-identical against 2,700 real
// rows, 2026-10-01 — see PROGRESS.md). The live-fetch path in
// lib/mistakes.ts has no DB row to read a column from, so it still calls
// moveNotations() itself; that's unchanged.
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
  type Decision,
  type DecisionKind,
  type Severity,
} from "@/lib/mistakes";
import { computeCubeStates, type CubeState } from "@/lib/cubeState";

// Exported for lib/decisionFromRow.ts's own decisionFromRowForReplay below
// to reuse verbatim, rather than re-declaring the same mapping twice.
export const KIND_MAP: Record<PrismaDecisionKind, DecisionKind> = {
  CHECKER: "checker",
  CUBE: "cube",
  RESIGNATION: "resignation",
};

// DOUBTFUL is Galaxy's mildest graded-mistake tier. lib/mistakes.ts's own
// Severity type only has "error" | "blunder" (it computes severity from a
// threshold on absError, not from Galaxy's own classification at all) — and
// BoardPanel only branches on
// `=== "blunder"` vs anything else, so DOUBTFUL maps to the closest
// existing bucket ("error") rather than extending that type. NONE means no
// real mistake, mapped to null to match lib/mistakes.ts's own convention
// for a clean decision.
// Exported for the same reason as KIND_MAP above.
export function severityFor(severity: PrismaErrorSeverity): Severity | null {
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
  // Populated at ingest (lib/ingest.ts) from the same raw JSON this file
  // used to re-parse on every read via moveNotations() — confirmed
  // byte-identical against 2,700 real rows across all 3 kinds (2026-10-01)
  // before switching. Null for non-CHECKER kinds, same as moveNotations()
  // already returned.
  notationPlayed: string | null;
  notationBest: string | null;
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

// Same shape as buildRollLookup above (same input, same "gameId:eventId"
// key), for the cumulative cube state (lib/cubeState.ts) instead of dice
// rolls — the caller must fetch every Decision row for a game (not just
// the countAsDecision: true ones a mistake-focused query normally selects)
// for computeCubeStates to walk correctly, same requirement as the roll
// lookup.
export function buildCubeStateLookup(
  gameRows: { gameId: number; eventId: bigint; raw: unknown }[]
): Map<string, CubeState> {
  const byGame = new Map<number, { eventId: bigint; event: GameEvent }[]>();
  for (const row of gameRows) {
    const list = byGame.get(row.gameId) ?? [];
    list.push({ eventId: row.eventId, event: row.raw as unknown as GameEvent });
    byGame.set(row.gameId, list);
  }

  const lookup = new Map<string, CubeState>();
  for (const [gameId, rows] of byGame) {
    rows.sort((a, b) => (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0));
    const events = rows.map((r) => r.event);
    const cubeStates = computeCubeStates(events);
    for (const r of rows) {
      const state = cubeStates.get(r.event.id);
      if (state) lookup.set(`${gameId}:${r.eventId}`, state);
    }
  }
  return lookup;
}

// Returns null for a row with no usable data (rawError null, or somehow no
// reviews[0] in its own raw JSON) — same "ungraded, skip it" treatment
// lib/mistakes.ts's own extractDecisions gives a null rawError, rather than
// crashing or faking a zero. `rollLookup`/`cubeStateLookup` are optional so
// callers that don't need them (or haven't fetched the sibling rows) can
// omit them and get an empty roll / null cube state.
export function decisionFromRow(
  row: DecisionRow,
  rollLookup?: Map<string, number[]>,
  cubeStateLookup?: Map<string, CubeState>
): Decision | null {
  if (row.rawError === null) return null;

  const event = row.raw as unknown as GameEvent;
  const review = event.reviews?.[0];
  if (!review) return null;

  const { mine, best } = actionLabels(review);
  const myMoveNotation = row.notationPlayed;
  const bestMoveNotation = row.notationBest;
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
    cubeState: cubeStateLookup?.get(`${row.gameId}:${row.eventId}`) ?? null,
  };
}

// Same as decisionFromRow above, but for a full-game replay
// (app/matches/[matchId]/replay/[gameIndex]): does NOT skip a row with
// rawError === null. Every ingested Decision row already has a non-null
// error_analysis (lib/ingest.ts skips outcome-logging events with no real
// decision at all before a row is ever created — see its
// EVENT_TYPES_SAFE_FOR_NULL_ERROR_ANALYSIS handling), but a stored row's
// error_analysis.raw_error can still itself be null for a partial/low-
// confidence analysis, and countAsDecision is always false for a cube-check
// dice-roll analysis or a forced single-legal-move — decisionFromRow (and
// every current caller of it) intentionally treats both as "not a gradeable
// mistake, skip" for their own mistake-focused views. A replay shows the
// game exactly as played instead, so nothing here is filtered on either
// count_as_decision or a null raw_error — only a row with no review data at
// all (shouldn't happen for anything actually ingested) returns null.
export function decisionFromRowForReplay(
  row: DecisionRow,
  rollLookup?: Map<string, number[]>,
  cubeStateLookup?: Map<string, CubeState>
): Decision | null {
  const event = row.raw as unknown as GameEvent;
  const review = event.reviews?.[0];
  if (!review) return null;

  const { mine, best } = actionLabels(review);
  const myMoveNotation = row.notationPlayed;
  const bestMoveNotation = row.notationBest;
  const absError = row.rawError === null ? 0 : Math.abs(row.rawError);

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
    cubeState: cubeStateLookup?.get(`${row.gameId}:${row.eventId}`) ?? null,
  };
}

// One row of the list + detail view (app/components/match-analysis/
// DecisionListWithDetail.tsx) on /mistakes and /repeated-positions.
export interface DecisionListItem {
  decision: Decision;
  classification: string;
  matchHref: string;
}

// A DecisionRow plus the two extra fields a list item needs.
export interface DecisionListRow extends DecisionRow {
  classification: string;
  game: { gameIndex: number; match: { sourceMatchId: string } };
}

// Rows (in display order) -> list items, dropping any row decisionFromRow
// can't build a board card from. The DB side — fetching the sibling rows
// `rollLookup` is built from — is lib/decisionQueries.ts's loadDecisionItems.
export function toDecisionListItems(
  rows: DecisionListRow[],
  rollLookup: Map<string, number[]>,
  cubeStateLookup?: Map<string, CubeState>
): DecisionListItem[] {
  const items: DecisionListItem[] = [];
  for (const row of rows) {
    const decision = decisionFromRow(row, rollLookup, cubeStateLookup);
    if (!decision) continue;
    items.push({
      decision,
      classification: row.classification,
      matchHref: `/matches/${row.game.match.sourceMatchId}`,
    });
  }
  return items;
}
