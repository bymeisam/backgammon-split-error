// Decision-table reads shared by /mistakes and /repeated-positions.
// Server-only (Prisma). The pure row -> item mapping these feed lives in
// lib/decisionFromRow.ts (toDecisionListItems) so it stays testable
// without a database.
import type { ErrorSeverity, Prisma } from "@/lib/generated/prisma/client";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import {
  buildCubeStateLookup,
  buildRollLookup,
  toDecisionListItems,
  type DecisionListItem,
  type DecisionListRow,
} from "@/lib/decisionFromRow";

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
  notationPlayed: true,
  notationBest: true,
  sourcePositionId: true,
  raw: true,
  game: { select: { gameIndex: true, match: { select: { sourceMatchId: true } } } },
} satisfies Prisma.DecisionSelect;

// A checker decision's own move_commited event never carries its roll —
// the preceding dice_rolled event does, stored as its own sibling Decision
// row (kind: CUBE, often countAsDecision: false) in the same game. List
// queries only select countAsDecision: true rows, so they never see those
// siblings; fetch every row for just the games actually in `rows` (cheap —
// a handful of games, not the whole table) and build a "gameId:eventId" ->
// roll lookup from them. The same unfiltered per-game rows also drive the
// cumulative cube-state lookup (lib/cubeState.ts) — same reasoning: a cube
// action that resolved the game's cube need not itself be one of the
// countAsDecision: true rows `rows` is scoped to.
export async function loadDecisionItems(rows: DecisionListRow[]): Promise<DecisionListItem[]> {
  const gameIds = [...new Set(rows.map((row) => row.gameId))];
  const gameRows =
    gameIds.length > 0
      ? await prisma.decision.findMany({
          where: { gameId: { in: gameIds } },
          select: { gameId: true, eventId: true, raw: true },
        })
      : [];
  return toDecisionListItems(rows, buildRollLookup(gameRows), buildCubeStateLookup(gameRows));
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
