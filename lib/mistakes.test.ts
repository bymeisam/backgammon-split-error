import { describe, expect, it } from "vitest";
import {
  computePR,
  isListedMistake,
  extractDecisions,
  formatPR,
  partitionMistakes,
  scopeDecisions,
  severityFromErrorSeverity,
  type Decision,
  type FetchedGame,
} from "@/lib/mistakes";
import { decodeGnuMatchId, encodeGnuMatchId } from "@/lib/gnuMatchId";
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
    d("c1", { kind: "checker", isMistake: true, absError: 0.05, severity: "error" }),
    d("c2", { kind: "checker", isMistake: false }),
    d("c3", { kind: "checker", isMistake: true, absError: 0.2, severity: "blunder" }),
    d("q1", { kind: "cube", isMistake: true, absError: 0.1, severity: "blunder" }),
    d("q2", { kind: "cube", isMistake: true, absError: 0.05, severity: "error" }),
    d("r1", { kind: "resignation", isMistake: true, absError: 0.9, severity: "blunder" }),
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

describe("partitionMistakes — Best (none) decisions are never listed as mistakes", () => {
  // Galaxy graded these none (severity null) though rawError is positive:
  // the played move beat Galaxy's rank 1. Galaxy shows them as Best.
  const decisions = [
    d("e", { kind: "checker", isMistake: true, absError: 0.05, severity: "error" }),
    d("n", { kind: "checker", isMistake: true, absError: 0.03, severity: null }),
    d("nc", { kind: "cube", isMistake: true, absError: 0.04, severity: null }),
    d("b", { kind: "cube", isMistake: true, absError: 0.2, severity: "blunder" }),
  ];
  const p = partitionMistakes(decisions);

  it("leaves them out of both mistake lists", () => {
    expect(isListedMistake(decisions[1])).toBe(false);
    expect(isListedMistake(decisions[2])).toBe(false);
    expect(ids(p.checkerMistakes)).toEqual(["e"]);
    expect(ids(p.cubeMistakes)).toEqual(["b"]);
    expect(ids(p.allMistakes)).toEqual(["b", "e"]);
  });

  it("keeps them in PR: computePR still counts their error", () => {
    // (0.05 + 0.03) / 2 decisions * 500.
    expect(ids(p.checkerDecisions)).toEqual(["e", "n"]);
    const checker = computePR(p.checkerDecisions, () => true);
    expect(checker.pr).toBeCloseTo((0.08 / 2) * 500);
    // (0.04 + 0.2) / 2 * 500.
    expect(computePR(p.cubeDecisions, () => true).pr).toBeCloseTo((0.24 / 2) * 500);
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

// The roll is the Match ID's dice — the same rule as the DB-row path
// (lib/gnuMatchId.ts's diceRollFor) — not a scan back to a preceding
// dice_rolled event, so the order the events arrive in can't change it.
describe("extractDecisions — roll from the decision's own Match ID", () => {
  function moveWithDice(dice: [number, number]) {
    const e = structuredClone(moneyGameMove.data.events[0]) as unknown as {
      id: number;
      reviews: { source_match: unknown }[];
    };
    e.reviews[0].source_match = {
      id: 1,
      formatted_value: encodeGnuMatchId({ ...decodeGnuMatchId("QQmxAAAACAAE")!, dice }),
    };
    return e;
  }
  // A preceding dice_rolled event carrying a different roll.
  const diceRolled = { id: 1, event_type: "dice_rolled", rolled_dice: [3, 3], user_id: "u", color: "white", moves: [], reviews: [] };

  function game(events: unknown[]): FetchedGame {
    return { gameIndex: 1, data: { type: "game_events", data: { events, match_id: 1, game_index: 1 } } as never };
  }

  it("uses the Match ID's dice even when a preceding dice_rolled event says otherwise, in either event order", () => {
    const move = moveWithDice([5, 2]);
    expect(extractDecisions([game([diceRolled, move])])[0].roll).toEqual([5, 2]);
    expect(extractDecisions([game([move, diceRolled])])[0].roll).toEqual([5, 2]);
  });

  it("no Match ID -> no dice", () => {
    expect(extractDecisions([game([diceRolled, moneyGameMove.data.events[0]])])[0].roll).toEqual([]);
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
