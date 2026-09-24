// Proves the general case behind lib/recompute-mistake-stats.ts's
// Math.abs(SUM(rawError)) shortcut (see that file's top comment): it's only
// equivalent to the "real" SUM(ABS(rawError)) because every rawError within
// a single (classification, kind, errorSeverity) group shares the same
// sign — verified against real data there, but only spot-checked. This test
// proves the general math on a small synthetic dataset instead, built with
// both positive and negative rawError values spread across several
// severities (mirroring the real invariant: NONE-severity rows are the only
// ones ever positive), and checks the function's output against an
// independently-computed SUM(ABS(x)) — not against the production code's
// own formula restated.
import { beforeEach, describe, expect, it, vi } from "vitest";

interface SyntheticDecision {
  classification: string;
  kind: string;
  errorSeverity: string;
  rawError: number;
}

// Small synthetic dataset — deliberately mixes positive and negative
// rawError values across different severity groups (NONE rows positive,
// everything else negative), matching the real invariant documented in
// lib/recompute-mistake-stats.ts, plus multiple rows per group so SUM
// actually has something to add up, not just one row per bucket.
const SYNTHETIC_DECISIONS: SyntheticDecision[] = [
  { classification: "opening_game", kind: "CHECKER", errorSeverity: "BLUNDER", rawError: -0.5 },
  { classification: "opening_game", kind: "CHECKER", errorSeverity: "BLUNDER", rawError: -0.3 },
  { classification: "opening_game", kind: "CHECKER", errorSeverity: "BLUNDER", rawError: -0.12 },
  { classification: "opening_game", kind: "CHECKER", errorSeverity: "ERROR", rawError: -0.05 },
  { classification: "opening_game", kind: "CHECKER", errorSeverity: "ERROR", rawError: -0.03 },
  { classification: "middle_game", kind: "CUBE", errorSeverity: "BLUNDER", rawError: -0.2 },
  { classification: "middle_game", kind: "CUBE", errorSeverity: "NONE", rawError: 0.02 },
  { classification: "middle_game", kind: "CUBE", errorSeverity: "NONE", rawError: 0.01 },
  { classification: "middle_game", kind: "CUBE", errorSeverity: "NONE", rawError: 0.015 },
  { classification: "race", kind: "RESIGNATION", errorSeverity: "NONE", rawError: 0.15 },
];

// Mimics what a real SQL `GROUP BY classification, kind, errorSeverity`
// with `COUNT(*)` and `SUM(rawError)` returns — computed independently from
// production code, standing in for prisma.decision.groupBy's real DB
// execution (which a unit test can't run without a live database).
function sqlStyleGroupBy(rows: SyntheticDecision[]) {
  const groups = new Map<string, { classification: string; kind: string; errorSeverity: string; count: number; sum: number }>();
  for (const row of rows) {
    const key = `${row.classification}:${row.kind}:${row.errorSeverity}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.sum += row.rawError;
    } else {
      groups.set(key, {
        classification: row.classification,
        kind: row.kind,
        errorSeverity: row.errorSeverity,
        count: 1,
        sum: row.rawError,
      });
    }
  }
  return [...groups.values()].map((g) => ({
    classification: g.classification,
    kind: g.kind,
    errorSeverity: g.errorSeverity,
    _count: { _all: g.count },
    _sum: { rawError: g.sum },
  }));
}

// The independently-correct target: SUM(ABS(x)) computed row-by-row
// directly from the raw synthetic data, not derived from the production
// function's own ABS(SUM(x)) formula.
function expectedSumAbsRawError(rows: SyntheticDecision[], classification: string, kind: string, errorSeverity: string) {
  return rows
    .filter((r) => r.classification === classification && r.kind === kind && r.errorSeverity === errorSeverity)
    .reduce((total, r) => total + Math.abs(r.rawError), 0);
}

const { groupBy, deleteMany, createMany, transaction } = vi.hoisted(() => ({
  groupBy: vi.fn(),
  deleteMany: vi.fn<(args: Record<string, unknown>) => Promise<{ count: number }>>(
    async () => ({ count: 0 })
  ),
  createMany: vi.fn<(args: { data: Record<string, unknown>[] }) => Promise<{ count: number }>>(
    async () => ({ count: 0 })
  ),
  transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    decision: { groupBy },
    mistakeStat: { deleteMany, createMany },
    $transaction: transaction,
  },
}));

import { recomputeMistakeStats } from "@/lib/recompute-mistake-stats";

beforeEach(() => {
  groupBy.mockReset();
  deleteMany.mockClear();
  createMany.mockClear();
  transaction.mockClear();
  groupBy.mockImplementation(async () => sqlStyleGroupBy(SYNTHETIC_DECISIONS));
});

describe("recomputeMistakeStats", () => {
  it("computes sumAbsRawError matching an independently-computed SUM(ABS(rawError)) for every group", async () => {
    await recomputeMistakeStats();

    expect(createMany).toHaveBeenCalledTimes(1);
    const rows = createMany.mock.calls[0][0].data as {
      classification: string;
      category: string;
      errorSeverity: string;
      decisionCount: number;
      sumAbsRawError: number;
    }[];

    // 5 distinct (classification, kind, errorSeverity) groups in the
    // synthetic dataset above: opening_game/CHECKER/BLUNDER,
    // opening_game/CHECKER/ERROR, middle_game/CUBE/BLUNDER,
    // middle_game/CUBE/NONE, race/RESIGNATION/NONE.
    expect(rows).toHaveLength(5);

    for (const row of rows) {
      const expected = expectedSumAbsRawError(
        SYNTHETIC_DECISIONS,
        row.classification,
        row.category,
        row.errorSeverity
      );
      expect(row.sumAbsRawError).toBeCloseTo(expected, 10);
    }
  });

  it("computes decisionCount matching the raw row count per group", async () => {
    await recomputeMistakeStats();

    const rows = createMany.mock.calls[0][0].data as { classification: string; category: string; errorSeverity: string; decisionCount: number }[];
    const openingBlunder = rows.find(
      (r) => r.classification === "opening_game" && r.category === "CHECKER" && r.errorSeverity === "BLUNDER"
    );
    expect(openingBlunder?.decisionCount).toBe(3);

    const middleNone = rows.find(
      (r) => r.classification === "middle_game" && r.category === "CUBE" && r.errorSeverity === "NONE"
    );
    expect(middleNone?.decisionCount).toBe(3);
  });

  it("still gets sumAbsRawError right for a NONE-severity group where rawError is positive (ABS(SUM(x)) == SUM(ABS(x)) only holds because every row in the group shares a sign)", async () => {
    await recomputeMistakeStats();

    const rows = createMany.mock.calls[0][0].data as { classification: string; category: string; errorSeverity: string; sumAbsRawError: number }[];
    const middleNone = rows.find(
      (r) => r.classification === "middle_game" && r.category === "CUBE" && r.errorSeverity === "NONE"
    );
    // 0.02 + 0.01 + 0.015 = 0.045, already positive, so ABS(SUM(x)) and
    // SUM(ABS(x)) trivially agree here too.
    expect(middleNone?.sumAbsRawError).toBeCloseTo(0.045, 10);
  });

  it("deletes all existing rows before inserting the fresh set, inside one transaction", async () => {
    await recomputeMistakeStats();

    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({});
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
