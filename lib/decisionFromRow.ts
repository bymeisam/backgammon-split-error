// Builds a lib/mistakes.ts `Decision` (the shape BoardPanel consumes)
// directly from one already-ingested Decision DB row — no live Galaxy call,
// no surrounding game context needed. Each row is self-contained: its own
// `raw` JSON column holds the full original event. Since 2026-10-07 every
// display value that isn't a kept column — colour, roll, cube, labels and
// move notations, the board frame — is derived from that `raw` through the
// source dispatcher (lib/analysis/index.ts), using the same rules the live
// path (lib/mistakes.ts's extractDecisions) applies to a fetched event. The
// columns that used to hold copies of them were dropped
// (reports/2026-10-07-column-audit.md; docs/field-mapping.md, "Derived from
// raw"). Columns still read: kind, rawError, errorSeverity, userId,
// sourcePositionId, and the joined note / gameIndex / match source.
//
// Server-only (imports the Prisma-generated enum types) — never import this
// from a "use client" file; pass the resulting plain Decision objects down
// as props instead, the way app/mistakes/page.tsx does.
import type {
  DecisionKind as PrismaDecisionKind,
  ErrorSeverity as PrismaErrorSeverity,
} from "@/lib/generated/prisma/client";
import type { ErrorSeverity as RawErrorSeverity } from "@/lib/gameReviewsTypes";
import {
  severityFromErrorSeverity,
  type Decision,
  type DecisionKind,
  type Severity,
} from "@/lib/mistakes";
import {
  decisionBoardFrame,
  decisionColor,
  decisionCubeState,
  decisionLabels,
  decisionRoll,
} from "@/lib/analysis";
import { externalMatchUrl } from "@/lib/externalMatchUrl";
import { isReviewEligible } from "@/lib/review/eligibility";

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
  kind: PrismaDecisionKind;
  rawError: number | null;
  errorSeverity: PrismaErrorSeverity;
  // Populated at ingest from review.source_position.formatted_value — a
  // plain indexed column (see reports/2026-10-02-step3-sourcepositionid-
  // column-design.md).
  sourcePositionId: string | null;
  // The source's untouched event; every other display value is derived from
  // it (lib/analysis/index.ts). Json column, so `unknown`.
  raw: unknown;
  // The joined DecisionNote (1:1, null when the decision has no note) —
  // every query that feeds a board selects it (DECISION_LIST_SELECT in
  // lib/decisionQueries.ts, the replay page's own select).
  note: { note: string; updatedAt: Date } | null;
  // Review feature (optional: only the board queries select them —
  // DECISION_LIST_SELECT and the replay's own select). countAsDecision
  // feeds the eligibility rule (lib/review/eligibility.ts); without it the
  // decision isn't offered for review.
  countAsDecision?: boolean;
  reviewCard?: { id: number; due: Date; suspended: boolean } | null;
  tags?: { tag: { id: number; name: string } }[];
  // match.source picks the reader for `raw` (lib/analysis/index.ts).
  game: { gameIndex: number; match: { source: string } };
}

// Returns null for a row with no usable data (rawError null, or somehow no
// reviews[0] in its own raw JSON) — same "ungraded, skip it" treatment
// lib/mistakes.ts's own extractDecisions gives a null rawError, rather than
// crashing or faking a zero.
export function decisionFromRow(row: DecisionRow): Decision | null {
  if (row.rawError === null) return null;
  return buildDecision(row, Math.abs(row.rawError));
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
// Resignations are replay steps too ("Resign", no dice, no analysis).
export function decisionFromRowForReplay(row: DecisionRow): Decision | null {
  return buildDecision(row, row.rawError === null ? 0 : Math.abs(row.rawError));
}

// Null when `raw` has nothing to label (no review) — same "skip it" both
// builders above give such a row.
function buildDecision(row: DecisionRow, absError: number): Decision | null {
  const input = { source: row.game.match.source, raw: row.raw };
  const labels = decisionLabels(input);
  if (!labels) return null;

  return {
    id: String(row.id),
    gameIndex: row.game.gameIndex,
    userId: row.userId,
    color: decisionColor(input),
    kind: KIND_MAP[row.kind],
    absError,
    isMistake: absError > 0,
    severity: severityFor(row.errorSeverity),
    myLabel: labels.mine,
    bestLabel: labels.best,
    bestDetail: labels.bestDetail,
    roll: decisionRoll(input),
    sourcePositionId: row.sourcePositionId,
    myMoveNotation: labels.myMoveNotation,
    bestMoveNotation: labels.bestMoveNotation,
    cubeState: decisionCubeState(input),
    ...decisionBoardFrame(input),
    note: row.note?.note ?? null,
    dbDecisionId: row.id,
    reviewCard: row.reviewCard
      ? { cardId: row.reviewCard.id, due: row.reviewCard.due.toISOString(), suspended: row.reviewCard.suspended }
      : null,
    reviewEligible:
      row.countAsDecision !== undefined &&
      isReviewEligible({
        kind: row.kind,
        countAsDecision: row.countAsDecision,
        rawError: row.rawError,
        source: row.game.match.source,
        raw: row.raw,
      }),
    tags: (row.tags ?? []).map((t) => ({ id: t.tag.id, name: t.tag.name })),
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
