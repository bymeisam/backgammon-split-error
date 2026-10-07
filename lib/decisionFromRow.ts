// Builds a lib/mistakes.ts `Decision` (the shape BoardPanel consumes)
// directly from one already-ingested Decision
// DB row — no live Galaxy call, no surrounding game context needed. Each
// row is self-contained: its own `raw` JSON column holds the full original
// event (including reviews[0]), but myLabel/bestLabel/myMoveNotation/
// bestMoveNotation/sourcePositionId/roll/cubeState all read the row's own
// movePlayed/moveBest/cubeActionPlayed/cubeActionBest/sourcePositionId/
// roll/cubeValue+cubeConfident columns directly rather than
// re-parsing raw or re-scanning sibling rows, since ingest already stores
// exactly this (notation: confirmed byte-identical against 2,700 real
// rows, 2026-10-01 — see PROGRESS.md; cube action labels: reports/2026-10-
// 02-raw-field-reverification.md; sourcePositionId: reports/2026-10-02-
// step3-sourcepositionid-column-design.md; roll: reports/2026-10-02-step4-
// dice-roll-column-design.md; cubeState: reports/2026-10-02-step5-cube-
// value-confident-design.md). Two things do read raw: RESIGNATION kind's
// labels (no stored column — deliberate scope decision, see labelsFor
// below), and, since 2026-10-06, a CUBE row's derived "best" action (from
// cube_analysis' equities) and the cube's board side (from the Match ID's
// dice owner — see cubeStateFor). The
// live-fetch path in lib/mistakes.ts has no DB row to read a column from,
// so it still re-parses raw/re-scans for everything; that's unchanged.
//
// Server-only (imports the Prisma-generated enum types) — never import this
// from a "use client" file; pass the resulting plain Decision objects down
// as props instead, the way app/mistakes/page.tsx does.
import type {
  DecisionKind as PrismaDecisionKind,
  ErrorSeverity as PrismaErrorSeverity,
} from "@/lib/generated/prisma/client";
import type { ErrorSeverity as RawErrorSeverity, GameEvent, Review } from "@/lib/gameReviewsTypes";
import {
  displayLabels,
  severityFromErrorSeverity,
  type Decision,
  type DecisionKind,
  type Severity,
} from "@/lib/mistakes";
import {
  cubeListValue,
  cubeSide,
  doubleOfferFor,
  positionFromOpponent,
  type CubeState,
  type DoubleOffer,
} from "@/lib/cubeState";
import { decodeGnuMatchId } from "@/lib/gnuMatchId";
import { externalMatchUrl } from "@/lib/externalMatchUrl";

// myLabel/bestLabel for CHECKER/CUBE kind come straight from the row's own
// columns (same values actionLabels(review) would compute — confirmed
// byte-identical before this switch, same discipline as the earlier
// notation-column fix). RESIGNATION kind has no column for this — stays
// read-time-computed via actionLabels(), a deliberate scope decision (see
// reports/2026-10-02-raw-field-reverification.md), not every kind getting
// the same treatment.
//
// CUBE kind's displayed "best" is then replaced by the action derived from
// the row's own cube equities, and CUBE/RESIGNATION labels are put in
// Galaxy's wording (displayLabels, lib/cubeAction.ts) — cubeActionBest
// stays Galaxy's stored label, which is unreliable on old analyses and
// isn't displayed.
function labelsFor(
  row: DecisionRow,
  review: Review
): { mine: string; best: string; bestDetail: string | null } {
  if (row.kind === "CHECKER") {
    return { mine: row.movePlayed ?? "?", best: row.moveBest ?? "?", bestDetail: null };
  }
  const severity = row.errorSeverity.toLowerCase() as RawErrorSeverity;
  if (row.kind === "CUBE") {
    return displayLabels(
      review,
      { mine: row.cubeActionPlayed ?? "?", best: row.cubeActionBest ?? "?" },
      severity
    );
  }
  return displayLabels(review, undefined, severity);
}

// The board's cube for this row. cubeValue/cubeConfident are the stored
// truth (from the row's GNU Match ID at ingest/backfill); the side is
// relative to the stored position's on-roll player (the Match ID's dice
// owner) — not the row's actor. On a cube_pass row the stored position is
// the doubler's; BoardPanel flips that board and this cube together
// (positionFromOpponent) so the receiver is at the bottom and the cube stays
// beside its real owner. cubeConfident = false (Match ID didn't decode)
// draws no cube.
function cubeStateFor(row: DecisionRow, review: Review): CubeState | null {
  if (row.cubeValue === null || row.cubeConfident !== true) return null;
  const m = decodeGnuMatchId(review.source_match?.formatted_value);
  if (!m) return null;
  return { value: row.cubeValue, owner: cubeSide(m.cubeOwner, m.diceOwner), confident: true };
}

// The board-frame, take/pass and list-square fields shared by both
// builders below — see Decision.positionFromOpponent/doubleOffer/
// cubeSquareValue in lib/mistakes.ts.
function boardFrameFor(review: Review): {
  positionFromOpponent: boolean;
  doubleOffer: DoubleOffer | null;
  cubeSquareValue: number | null;
} {
  const m = decodeGnuMatchId(review.source_match?.formatted_value);
  const event = review.result.analysed_event;
  return {
    positionFromOpponent: positionFromOpponent(event, m),
    doubleOffer: doubleOfferFor(event, m, review.take),
    cubeSquareValue: cubeListValue(event, m, review.double),
  };
}

// The dice to show for this row. A cube decision is made before the roll,
// so it gets none — the stored roll column on a CUBE row is a neighbouring
// event's roll (see docs/field-mapping.md's `roll` row). Same rule the live
// path (lib/mistakes.ts's extractDecisions) already applies.
export function rollForRow(row: Pick<DecisionRow, "kind" | "roll">): number[] {
  if (row.kind === "CUBE") return [];
  return (row.roll as number[] | null) ?? [];
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
  return severityFromErrorSeverity(severity.toLowerCase() as RawErrorSeverity);
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
  // already returned. Renamed from notationPlayed/notationBest 2026-10-02
  // (reports/2026-10-02-raw-field-reverification.md) for parallel naming
  // with cubeActionPlayed/cubeActionBest below — same values, name only.
  movePlayed: string | null;
  moveBest: string | null;
  // CUBE-kind-only mine/best short labels, same values actionLabels()
  // would compute for a CUBE-kind review — see labelsFor above. Replaces
  // the old cubeDetail column (a single composed display string, confirmed
  // 2026-10-02 never rendered anywhere, dropped).
  cubeActionPlayed: string | null;
  cubeActionBest: string | null;
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
  // Absolute owner (a real user_id, or null for centered), value and
  // confident flag, all from the row's own GNU Match ID (2026-10-06,
  // replacing the retired take-walk) — see cubeStateFor above and
  // docs/field-mapping.md's "GNU Match ID" section.
  cubeOwnerUserId: string | null;
  cubeValue: number | null;
  cubeConfident: boolean | null;
  raw: unknown;
  // The joined DecisionNote (1:1, null when the decision has no note) —
  // every query that feeds a board selects it (DECISION_LIST_SELECT in
  // lib/decisionQueries.ts, the replay page's own select).
  note: { note: string; updatedAt: Date } | null;
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

  const { mine, best, bestDetail } = labelsFor(row, review);
  const myMoveNotation = row.movePlayed;
  const bestMoveNotation = row.moveBest;
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
    myLabel: mine,
    bestLabel: best,
    bestDetail,
    roll: rollForRow(row),
    sourcePositionId: row.sourcePositionId,
    myMoveNotation,
    bestMoveNotation,
    cubeState: cubeStateFor(row, review),
    ...boardFrameFor(review),
    note: row.note?.note ?? null,
    dbDecisionId: row.id,
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

  const { mine, best, bestDetail } = labelsFor(row, review);
  const myMoveNotation = row.movePlayed;
  const bestMoveNotation = row.moveBest;
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
    myLabel: mine,
    bestLabel: best,
    bestDetail,
    roll: rollForRow(row),
    sourcePositionId: row.sourcePositionId,
    myMoveNotation,
    bestMoveNotation,
    cubeState: cubeStateFor(row, review),
    ...boardFrameFor(review),
    note: row.note?.note ?? null,
    dbDecisionId: row.id,
  };
}

// One row of the list + detail view (app/components/match-analysis/
// DecisionListWithDetail.tsx) on /mistakes and /repeated-positions.
export interface DecisionListItem {
  decision: Decision;
  classification: string;
  matchHref: string;
  // The match on its source platform ("View on Galaxy"), or null for a
  // source with no such page — lib/externalMatchUrl.ts.
  externalMatchHref: string | null;
}

// A DecisionRow plus the extra fields a list item needs.
export interface DecisionListRow extends DecisionRow {
  classification: string;
  game: { gameIndex: number; match: { source: string; sourceMatchId: string } };
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
      externalMatchHref: externalMatchUrl(row.game.match.source, row.game.match.sourceMatchId),
    });
  }
  return items;
}
