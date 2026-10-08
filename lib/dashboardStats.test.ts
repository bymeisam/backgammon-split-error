import { describe, expect, it } from "vitest";
import { formatTimeAgo, lastSyncedLabel, tallyWeeklyMistakes } from "./dashboardStats";

describe("tallyWeeklyMistakes", () => {
  it("folds grouped rows into the checker/cube grid, BigInt counts included", () => {
    const tally = tallyWeeklyMistakes([
      { kind: "CHECKER", errorSeverity: "ERROR", n: BigInt(12) },
      { kind: "CHECKER", errorSeverity: "BLUNDER", n: BigInt(3) },
      { kind: "CUBE", errorSeverity: "ERROR", n: 2 },
      { kind: "CUBE", errorSeverity: "BLUNDER", n: BigInt(1) },
    ]);
    expect(tally).toEqual({
      checker: { errors: 12, blunders: 3 },
      cube: { errors: 2, blunders: 1 },
      total: { errors: 14, blunders: 4 },
    });
  });

  it("is all zeros for no rows", () => {
    expect(tallyWeeklyMistakes([])).toEqual({
      checker: { errors: 0, blunders: 0 },
      cube: { errors: 0, blunders: 0 },
      total: { errors: 0, blunders: 0 },
    });
  });

  it("ignores resignations and other severities", () => {
    const tally = tallyWeeklyMistakes([
      { kind: "RESIGNATION", errorSeverity: "BLUNDER", n: 5 },
      { kind: "CHECKER", errorSeverity: "DOUBTFUL", n: 7 },
      { kind: "CHECKER", errorSeverity: "NONE", n: 9 },
    ]);
    expect(tally.total).toEqual({ errors: 0, blunders: 0 });
  });
});

describe("formatTimeAgo", () => {
  const now = new Date(2026, 9, 8, 15, 0, 0);

  it("reads minutes, hours, then days", () => {
    expect(formatTimeAgo(new Date(2026, 9, 8, 14, 59, 30), now)).toBe("just now");
    expect(formatTimeAgo(new Date(2026, 9, 8, 14, 55, 0), now)).toBe("5 min ago");
    expect(formatTimeAgo(new Date(2026, 9, 8, 12, 0, 0), now)).toBe("3 h ago");
    expect(formatTimeAgo(new Date(2026, 9, 7, 9, 0, 0), now)).toBe("yesterday");
    expect(formatTimeAgo(new Date(2026, 9, 4, 9, 0, 0), now)).toBe("4 days ago");
  });

  it("reads a future time as just now", () => {
    expect(formatTimeAgo(new Date(2026, 9, 8, 16, 0, 0), now)).toBe("just now");
  });
});

describe("lastSyncedLabel", () => {
  const now = new Date(2026, 9, 8, 15, 0, 0);

  it("says when and how many", () => {
    expect(lastSyncedLabel({ finishedAt: new Date(2026, 9, 8, 14, 50, 0), matchesSynced: 3 }, now)).toBe(
      "Last synced 10 min ago · 3 matches"
    );
    expect(lastSyncedLabel({ finishedAt: new Date(2026, 9, 8, 14, 50, 0), matchesSynced: 1 }, now)).toBe(
      "Last synced 10 min ago · 1 match"
    );
  });

  it("says never without a finished run", () => {
    expect(lastSyncedLabel(null, now)).toBe("Never synced");
  });
});
