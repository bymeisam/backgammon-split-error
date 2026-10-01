import { describe, expect, it } from "vitest";
import {
  computePR,
  extractDecisions,
  formatPR,
  partitionMistakes,
  scopeDecisions,
  severityFromErrorSeverity,
  type Decision,
  type FetchedGame,
} from "@/lib/mistakes";
import blunderBelowThreshold from "./__fixtures__/galaxy-payloads/blunder-below-0.08-threshold.json";
import moneyGameMove from "./__fixtures__/galaxy-payloads/money-game-move.json";

function d(id: string, overrides: Partial<Decision> = {}): Decision {
  return {
    id,
    gameIndex: 1,
    userId: "me",
    color: "white",
    kind: "checker",
    absError: 0,
    isMistake: false,
    severity: null,
    detail: "",
    myLabel: "",
    bestLabel: "",
    roll: [],
    sourcePositionId: null,
    myMoveNotation: null,
    bestMoveNotation: null,
    cubeState: null,
    ...overrides,
  };
}

const ids = (list: Decision[]) => list.map((x) => x.id);

describe("scopeDecisions", () => {
  const all = [
    d("a", { userId: "me", gameIndex: 1 }),
    d("b", { userId: "opp", gameIndex: 1 }),
    d("c", { userId: "me", gameIndex: 2 }),
  ];

  it("keeps one player's decisions across all games", () => {
    expect(ids(scopeDecisions(all, "me", "all"))).toEqual(["a", "c"]);
  });

  it("narrows to one game", () => {
    expect(ids(scopeDecisions(all, "me", 2))).toEqual(["c"]);
  });

  it("matches nothing when no player is resolved", () => {
    expect(scopeDecisions(all, null, "all")).toEqual([]);
  });
});

describe("partitionMistakes", () => {
  const decisions = [
    d("c1", { kind: "checker", isMistake: true, absError: 0.05 }),
    d("c2", { kind: "checker", isMistake: false }),
    d("c3", { kind: "checker", isMistake: true, absError: 0.2 }),
    d("q1", { kind: "cube", isMistake: true, absError: 0.1 }),
    d("q2", { kind: "cube", isMistake: true, absError: 0.05 }),
    d("r1", { kind: "resignation", isMistake: true, absError: 0.9 }),
  ];
  const p = partitionMistakes(decisions);

  it("splits checker and cube decisions, leaving resignations out of both", () => {
    expect(ids(p.checkerDecisions)).toEqual(["c1", "c2", "c3"]);
    expect(ids(p.cubeDecisions)).toEqual(["q1", "q2"]);
  });

  it("lists each side's mistakes worst-first", () => {
    expect(ids(p.checkerMistakes)).toEqual(["c3", "c1"]);
    expect(ids(p.cubeMistakes)).toEqual(["q1", "q2"]);
  });

  it("merges both sides worst-first, checker before cube on ties", () => {
    expect(ids(p.allMistakes)).toEqual(["c3", "q1", "c1", "q2"]);
  });

  it("doesn't reorder the input", () => {
    expect(ids(decisions)).toEqual(["c1", "c2", "c3", "q1", "q2", "r1"]);
  });
});

describe("formatPR", () => {
  it("formats to two decimals, or a dash when there's no PR", () => {
    expect(formatPR(4.567)).toBe("4.57");
    expect(formatPR(0)).toBe("0.00");
    expect(formatPR(null)).toBe("—");
  });
});

describe("severityFromErrorSeverity", () => {
  it("maps blunder/error/doubtful/none to this app's narrower Severity", () => {
    expect(severityFromErrorSeverity("blunder")).toBe("blunder");
    expect(severityFromErrorSeverity("error")).toBe("error");
    expect(severityFromErrorSeverity("doubtful")).toBe("error");
    expect(severityFromErrorSeverity("none")).toBeNull();
  });
});

// extractDecisions had no test coverage at all before this — the exact gap
// that let its severity computation (a local absError >= 0.08 threshold)
// silently diverge from lib/decisionFromRow.ts's (reading Galaxy's own
// errorSeverity column) for over a month. Both now go through the single
// severityFromErrorSeverity mapping above.
describe("extractDecisions — severity sourced from Galaxy's own classification", () => {
  it("real case where the old absError-threshold logic would have disagreed with Galaxy's own severity", () => {
    // Real decision (id 7315, local dev DB): absError 0.0799 — just under
    // the old 0.08 "blunder" cutoff, so the old logic produced "error".
    // Galaxy's own error_analysis.error_severity is "blunder". Confirmed
    // via a real-data sweep (reports/2026-10-01-decision-raw-field-audit.md
    // finding #1) that this isn't the only such case, just the first found.
    const game: FetchedGame = { gameIndex: 1, data: blunderBelowThreshold as never };
    const [decision] = extractDecisions([game]);
    expect(decision).toBeDefined();
    expect(decision.absError).toBeCloseTo(0.0799);
    expect(decision.severity).toBe("blunder");
  });

  it("severity is null when Galaxy's own classification is 'none', even though absError is nonzero (isMistake: true)", () => {
    // Real decision (moneyGameMove's own event): raw_error -0.02 (so
    // isMistake is true) but error_severity is "none" — severity and
    // isMistake are independently sourced and don't always agree, same as
    // lib/decisionFromRow.ts's severityFor is never gated by isMistake
    // either. Confirms severity truly comes from Galaxy's classification,
    // not re-derived from absError in any form.
    const game: FetchedGame = { gameIndex: 1, data: moneyGameMove as never };
    const [decision] = extractDecisions([game]);
    expect(decision).toBeDefined();
    expect(decision.isMistake).toBe(true);
    expect(decision.severity).toBeNull();
  });
});

// Ties the pieces together the way MistakesSection uses them: unticking a
// mistake removes it from PR entirely (numerator and denominator).
describe("computePR with partitioned decisions", () => {
  it("drops an unticked mistake from the PR", () => {
    const { checkerDecisions } = partitionMistakes([
      d("a", { isMistake: true, absError: 0.1 }),
      d("b"),
      d("c"),
      d("e", { isMistake: true, absError: 0.3 }),
    ]);
    expect(computePR(checkerDecisions, () => true).pr).toBeCloseTo((0.4 / 4) * 500);
    expect(computePR(checkerDecisions, (id) => id !== "e").pr).toBeCloseTo((0.1 / 3) * 500);
  });
});
