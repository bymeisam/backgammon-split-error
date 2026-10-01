// Decision-table reads shared by /mistakes and /repeated-positions.
// Server-only (Prisma). The pure row -> item mapping these feed lives in
// lib/decisionFromRow.ts (toDecisionListItems) so it stays testable
// without a database.
import type { ErrorSeverity, Prisma } from "@/lib/generated/prisma/client";
import { prismaReadOnly as prisma } from "@/lib/prisma";
import {
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
  raw: true,
  game: { select: { gameIndex: true, match: { select: { sourceMatchId: true } } } },
} satisfies Prisma.DecisionSelect;

// A checker decision's own move_commited event never carries its roll —
// the preceding dice_rolled event does, stored as its own sibling Decision
// row (kind: CUBE, often countAsDecision: false) in the same game. List
// queries only select countAsDecision: true rows, so they never see those
// siblings; fetch every row for just the games actually in `rows` (cheap —
// a handful of games, not the whole table) and build a "gameId:eventId" ->
// roll lookup from them.
export async function loadDecisionItems(rows: DecisionListRow[]): Promise<DecisionListItem[]> {
  const gameIds = [...new Set(rows.map((row) => row.gameId))];
  const gameRows =
    gameIds.length > 0
      ? await prisma.decision.findMany({
          where: { gameId: { in: gameIds } },
          select: { gameId: true, eventId: true, raw: true },
        })
      : [];
  return toDecisionListItems(rows, buildRollLookup(gameRows));
}

// Every individual Decision that faced one RepeatedPosition's exact
// position. Narrows by the same indexed columns
// lib/recompute-repeated-positions.ts's own query uses
// (kind/countAsDecision/rawError/errorSeverity) before the unindexed JSON
// match — cheap once narrowed, not a full-table scan.
//
// FORCE INDEX: measured MySQL's optimizer picking
// Decision_kind_classification_idx here instead (kind-only, ~513k rows to
// then filter/JSON-extract one by one) over the composite index that also
// covers countAsDecision/rawError/errorSeverity — 11.4s vs. 1.2s for the
// exact same query, forced. The composite index's name is a fixed literal
// from the schema/migration, not user input, so it's safe to inline
// directly rather than bind as a parameter (FORCE INDEX takes an
// identifier, not a value, and can't be parameterized anyway).
export async function findPositionOccurrences(position: {
  errorSeverity: ErrorSeverity;
  sourcePositionId: string;
}): Promise<DecisionListRow[]> {
  const matchingIds = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM Decision
    FORCE INDEX (Decision_countAsDecision_rawError_kind_classification_errorS_idx)
    WHERE kind = 'CHECKER' AND countAsDecision = 1 AND rawError IS NOT NULL
      AND errorSeverity = ${position.errorSeverity}
      AND JSON_UNQUOTE(JSON_EXTRACT(raw, '$.reviews[0].source_position.formatted_value')) = ${position.sourcePositionId}
  `;

  return prisma.decision.findMany({
    where: { id: { in: matchingIds.map((r) => r.id) } },
    select: DECISION_LIST_SELECT,
  });
}
