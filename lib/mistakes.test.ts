import { describe, expect, it } from "vitest";
import {
  computePR,
  decodeRollFromMoves,
  isListedMistake,
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
    myLabel: "",
    bestLabel: "",
    roll: [],
    sourcePositionId: null,
    myMoveNotation: null,
    bestMoveNotation: null,
    cubeState: null,
    positionFromOpponent: false,
    doubleOffer: null,
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
  it("maps Galaxy's tiers: doubtful is its own mild Good tier, not an error", () => {
    expect(severityFromErrorSeverity("blunder")).toBe("blunder");
    expect(severityFromErrorSeverity("error")).toBe("error");
    expect(severityFromErrorSeverity("doubtful")).toBe("good");
    expect(severityFromErrorSeverity("none")).toBeNull();
  });
});

describe("partitionMistakes — Good (doubtful) decisions aren't listed as mistakes", () => {
  const decisions = [
    d("e", { kind: "checker", isMistake: true, absError: 0.05, severity: "error" }),
    d("g", { kind: "checker", isMistake: true, absError: 0.01, severity: "good" }),
    d("b", { kind: "cube", isMistake: true, absError: 0.2, severity: "blunder" }),
    d("gc", { kind: "cube", isMistake: true, absError: 0.015, severity: "good" }),
  ];
  const p = partitionMistakes(decisions);

  it("leaves them out of both mistake lists", () => {
    expect(ids(p.checkerMistakes)).toEqual(["e"]);
    expect(ids(p.cubeMistakes)).toEqual(["b"]);
    expect(ids(p.allMistakes)).toEqual(["b", "e"]);
    expect(isListedMistake(decisions[1])).toBe(false);
    expect(isListedMistake(decisions[0])).toBe(true);
  });

  it("keeps them in the decisions PR is computed over, so PR is unchanged", () => {
    expect(ids(p.checkerDecisions)).toEqual(["e", "g"]);
    expect(computePR(p.checkerDecisions, () => true).pr).toBeCloseTo((0.06 / 2) * 500);
  });
});

describe("decodeRollFromMoves", () => {
  it("real example: decision id 1207111's moves decode to [6,5], matching the roll independently confirmed on Galaxy's own site ([5,6], order-independent)", () => {
    expect(decodeRollFromMoves([24, 18, 18, 13])).toEqual([6, 5]);
  });

  it("two different checkers, non-double: each pair's own pip distance is a die face", () => {
    // "24/18 13/9" (distances 6, 4) — real shape, different point numbers
    // than the single-checker chain case above but same pairwise decoding.
    expect(decodeRollFromMoves([13, 9, 24, 18])).toEqual([4, 6]);
  });

  it("a double (all hops the same distance): returns [d, d], not every repeated hop", () => {
    // "14/4(2)" — 4 hops of 5 pips each (double 5s), 3-of-4 and 2-of-4
    // partial-double cases collapse the same way.
    expect(decodeRollFromMoves([14, 9, 14, 9, 9, 4, 9, 4])).toEqual([5, 5]);
    expect(decodeRollFromMoves([3, 0, 3, 0, 3, 0])).toEqual([3, 3]); // 3-of-4 used
  });

  it("returns null for a genuinely single-die turn (only 1 hop) — the other die's value isn't recoverable from moves either", () => {
    expect(decodeRollFromMoves([10, 5])).toBeNull();
  });

  it("returns null for a malformed/odd-length array rather than guessing", () => {
    expect(decodeRollFromMoves([])).toBeNull();
    expect(decodeRollFromMoves([1, 2, 3])).toBeNull();
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
