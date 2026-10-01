import { describe, expect, it } from "vitest";
import {
  computePR,
  formatPR,
  partitionMistakes,
  scopeDecisions,
  type Decision,
} from "@/lib/mistakes";

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
