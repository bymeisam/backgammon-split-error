// Builds a lib/mistakes.ts `Decision` (the shape BoardPanel consumes)
// directly from one already-ingested Decision
// DB row — no live Galaxy call, no surrounding game context needed. Each
// row is self-contained: its own `raw` JSON column holds the full original
// event (including reviews[0]), so the same label-derivation logic
// lib/mistakes.ts already uses for a live game_reviews fetch applies here
// unchanged for myLabel/bestLabel (via actionLabels) — but myMoveNotation/
// bestMoveNotation/sourcePositionId/roll/cubeState read the row's own
// notationPlayed/notationBest/sourcePositionId/roll/cubeOwnerUserId+
// cubeValue+cubeConfident columns directly rather than re-parsing raw or
// re-scanning sibling rows, since ingest already stores exactly this
// (notation: confirmed byte-identical against 2,700 real rows, 2026-10-01
// — see PROGRESS.md; sourcePositionId: reports/2026-10-02-step3-
// sourcepositionid-column-design.md; roll: reports/2026-10-02-step4-dice-
// roll-column-design.md; cubeState: reports/2026-10-02-step5-cube-value-
// confident-design.md). The live-fetch path in lib/mistakes.ts has no DB
// row to read a column from, so it still re-parses raw/re-scans for all of
// these; that's unchanged.
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
  severityFromErrorSeverity,
  type Decision,
  type DecisionKind,
  type Severity,
} from "@/lib/mistakes";
import type { CubeState } from "@/lib/cubeState";
import type { CubeOwner } from "@/lib/boardGeometry";

// Converts the row's own absolute cubeOwnerUserId (a real user_id, or null
// for centered) into the relative "mine"/"opponent"/"center" framing
// Decision.cubeState/BoardPanel already use — same relativization BoardPanel
// already applies to decoded positions, just at read time here instead of
// inside computeCubeStates (which only ever returns relative, never the
// absolute value this column stores).
function relativeCubeOwner(cubeOwnerUserId: string | null, viewerUserId: string): CubeOwner {
  if (cubeOwnerUserId === null) return "center";
  return cubeOwnerUserId === viewerUserId ? "mine" : "opponent";
}

function cubeStateFor(row: DecisionRow): CubeState | null {
  if (row.cubeValue === null || row.cubeConfident === null) return null;
  return {
    value: row.cubeValue,
    owner: relativeCubeOwner(row.cubeOwnerUserId, row.userId),
    confident: row.cubeConfident,
  };
}

// Exported for lib/decisionFromRow.ts's own decisionFromRowForReplay below
// to reuse verbatim, rather than re-declaring the same mapping twice.
export const KIND_MAP: Record<PrismaDecisionKind, DecisionKind> = {
  CHECKER: "checker",
  CUBE: "cube",
  RESIGNATION: "resignation",
};

// Thin adapter from the Prisma-generated (UPPERCASE) enum to
// lib/mistakes.ts's severityFromErrorSeverity, which takes the raw JSON's
// own (lowercase) ErrorSeverity — the one mapping both the DB-row path
// (this file) and the live-fetch path (lib/mistakes.ts's extractDecisions)
// now share, after an audit found they used to compute severity two
// different ways and could disagree (see severityFromErrorSeverity's own
// comment for the real example that proved it). Exported for the same
// reason as KIND_MAP above.
export function severityFor(severity: PrismaErrorSeverity): Severity | null {
  return severityFromErrorSeverity(severity.toLowerCase() as "none" | "doubtful" | "error" | "blunder");
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
  // Populated at ingest from review.source_position.formatted_value — same
  // value this file used to re-read from raw on every call via
  // review.source_position?.formatted_value, now a plain indexed column
  // (see reports/2026-10-02-step3-sourcepositionid-column-design.md).
  sourcePositionId: string | null;
  // Populated at ingest via the same findPrecedingRoll backward scan the
  // old buildRollLookup (removed) used to re-run at read time over sibling
  // rows — see reports/2026-10-02-step4-dice-roll-column-design.md. Json
  // column, so `unknown` here same as `raw` below; cast at the point of use.
  roll: unknown;
  // Absolute owner (a real user_id, or null for centered) — widened at
  // ingest (2026-10-02) to every kind, not just CUBE. cubeValue/
  // cubeConfident: the same computeCubeStates walk the old (removed)
  // buildCubeStateLookup used to re-run at read time, now a plain column
  // triple — see cubeStateFor above / reports/2026-10-02-step5-cube-value-
  // confident-design.md.
  cubeOwnerUserId: string | null;
  cubeValue: number | null;
  cubeConfident: boolean | null;
  raw: unknown;
  game: { gameIndex: number };
}

// Returns null for a row with no usable data (rawError null, or somehow no
// reviews[0] in its own raw JSON) — same "ungraded, skip it" treatment
// lib/mistakes.ts's own extractDecisions gives a null rawError, rather than
// crashing or faking a zero.
export function decisionFromRow(row: DecisionRow): Decision | null {
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
    roll: (row.roll as number[] | null) ?? [],
    sourcePositionId: row.sourcePositionId,
    myMoveNotation,
    bestMoveNotation,
    cubeState: cubeStateFor(row),
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
export function decisionFromRowForReplay(row: DecisionRow): Decision | null {
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
    roll: (row.roll as number[] | null) ?? [],
    sourcePositionId: row.sourcePositionId,
    myMoveNotation,
    bestMoveNotation,
    cubeState: cubeStateFor(row),
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
// can't build a board card from.
export function toDecisionListItems(rows: DecisionListRow[]): DecisionListItem[] {
  const items: DecisionListItem[] = [];
  for (const row of rows) {
    const decision = decisionFromRow(row);
    if (!decision) continue;
    items.push({
      decision,
      classification: row.classification,
      matchHref: `/matches/${row.game.match.sourceMatchId}`,
    });
  }
  return items;
}
