// Decision-table reads shared by /mistakes and /repeated-positions.
// Server-only (Prisma). The pure row -> item mapping these feed lives in
// lib/decisionFromRow.ts (toDecisionListItems) so it stays testable
// without a database.
import type { ErrorSeverity, Prisma } from "@/lib/generated/prisma/client";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import { toDecisionListItems, type DecisionListItem, type DecisionListRow } from "@/lib/decisionFromRow";

// Columns a DecisionListRow needs — every list query selects exactly this.
export const DECISION_LIST_SELECT = {
  id: true,
  gameId: true,
  eventId: true,
  userId: true,
  color: true,
  kind: true,
  rawError: true,
  errorSeverity: true,
  classification: true,
  movePlayed: true,
  moveBest: true,
  cubeActionPlayed: true,
  cubeActionBest: true,
  sourcePositionId: true,
  roll: true,
  cubeOwnerUserId: true,
  cubeValue: true,
  cubeConfident: true,
  raw: true,
  // The user's own note, if any (1:1 DecisionNote, null when absent) — a
  // unique-key lookup per returned row, so it only ever touches the page's
  // own rows, never the count query.
  note: { select: { note: true, updatedAt: true } },
  game: { select: { gameIndex: true, match: { select: { sourceMatchId: true } } } },
} satisfies Prisma.DecisionSelect;

// Used to need a second, unfiltered per-game query here to build roll/
// cube-state lookups from sibling rows (a countAsDecision: true list query
// alone never sees the countAsDecision: false rows those lookups needed) —
// both are now plain columns on `rows` directly (see reports/2026-10-02-
// step4-dice-roll-column-design.md and reports/2026-10-02-step5-cube-
// value-confident-design.md), so this is just a synchronous mapping now,
// no DB call. Kept as an async function (not changed to a plain export)
// so callers don't need updating if a future field ever needs this shape
// of lookup again.
export async function loadDecisionItems(rows: DecisionListRow[]): Promise<DecisionListItem[]> {
  return toDecisionListItems(rows);
}

// Every individual Decision that faced one RepeatedPosition's exact
// position. sourcePositionId/errorSeverity equality (the
// Decision_sourcePositionId_errorSeverity_idx index) narrows ~1.26M rows to
// a measured average of ~2 and a worst-known case of 10,923 before
// kind/countAsDecision/rawError are even applied — three to five orders of
// magnitude narrower than the ~494k-513k row scans the old
// JSON_EXTRACT-plus-FORCE-INDEX version had to fall back on (see
// reports/2026-10-02-step3-sourcepositionid-column-design.md). Now a plain
// Prisma query: sourcePositionId is a real indexed column, not an unindexed
// JSON path, so there's no optimizer-steering or raw SQL needed anymore.
export async function findPositionOccurrences(position: {
  errorSeverity: ErrorSeverity;
  sourcePositionId: string;
}): Promise<DecisionListRow[]> {
  return prisma.decision.findMany({
    where: {
      kind: "CHECKER",
      countAsDecision: true,
      rawError: { not: null },
      errorSeverity: position.errorSeverity,
      sourcePositionId: position.sourcePositionId,
    },
    select: DECISION_LIST_SELECT,
  });
}
