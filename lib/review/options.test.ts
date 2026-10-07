import { describe, expect, it } from "vitest";
import type { CheckerAnalysis, CubeAnalysis } from "@/lib/analysis/types";
import { getDecisionAnalysis } from "@/lib/analysis";
import { doublerAction } from "@/lib/cubeAction";
import {
  checkerOptions,
  cubeOptions,
  displayOptions,
  doublerOptions,
  gradeAnswer,
  playedCheckerKey,
  receiverOptions,
  shuffled,
  type ReviewOption,
} from "@/lib/review/options";
import { CORRECT_LOSS_THRESHOLD } from "@/lib/settings";
import examples from "@/lib/__fixtures__/analysis/galaxy-analysis-examples.json";

type Example = { decisionId: number; analysedEvent: string; raw: unknown };
const ex = examples as unknown as Record<string, Example>;

function checker(losses: number[], played = 0): CheckerAnalysis {
  return {
    v: 1,
    source: "galaxy",
    kind: "checker",
    candidates: losses.map((loss, i) => ({
      move: `m${i}`,
      rank: i + 1,
      equity: 0.5 + loss,
      loss,
      played: i === played,
      probs: null,
    })),
  };
}

const byKey = (opts: ReviewOption[]): Record<string, ReviewOption> => Object.fromEntries(opts.map((o) => [o.key, o]));

describe("checker options and grading", () => {
  it("every candidate is an option, keyed by its move; best is the first by equity", () => {
    const g = checkerOptions(checker([0, -0.01, -0.05, -0.2], 2));
    expect(g.options.map((o) => o.key)).toEqual(["m0", "m1", "m2", "m3"]);
    expect(g.bestKey).toBe("m0");
  });

  it("correct within the threshold: loss ≥ −0.02, the edge included", () => {
    const g = byKey(checkerOptions(checker([0, -0.02, -0.0201, -0.019])).options);
    expect(g.m0.correct).toBe(true);
    expect(g.m1.correct).toBe(true); // exactly −0.02
    expect(g.m2.correct).toBe(false);
    expect(g.m3.correct).toBe(true);
    expect(CORRECT_LOSS_THRESHOLD).toBe(0.02);
  });

  it("C1 (1236446): rank 3 is best by equity, and grading follows the equities", () => {
    const a = getDecisionAnalysis({ source: "galaxy", raw: ex.C1.raw }) as CheckerAnalysis;
    const g = checkerOptions(a);
    expect(g.bestKey).toBe(a.candidates[0].move);
    expect(a.candidates[0].rank).toBe(3);
    for (const o of g.options) expect(o.correct).toBe(o.loss >= -0.02);
    expect(gradeAnswer(a, a.candidates[0].move)).toEqual({ correct: true, loss: 0 });
  });

  it("the played move is always an option (F1: played rank 4)", () => {
    const a = getDecisionAnalysis({ source: "galaxy", raw: ex.F1.raw }) as CheckerAnalysis;
    const played = playedCheckerKey(a);
    expect(played).not.toBeNull();
    expect(checkerOptions(a).options.some((o) => o.key === played)).toBe(true);
  });

  it("display order is shuffled for checker cards, and the shuffle keeps every option", () => {
    const a = checker([0, -0.01, -0.05, -0.2, -0.3]);
    // A random source that always picks index 0 rotates the list.
    const shown = displayOptions(a, () => 0).options.map((o) => o.key);
    expect(shown).not.toEqual(["m0", "m1", "m2", "m3", "m4"]);
    expect([...shown].sort()).toEqual(["m0", "m1", "m2", "m3", "m4"]);
    expect(shuffled([1, 2, 3], () => 0.999)).toEqual([1, 2, 3]);
  });

  it("an unknown key grades to null", () => {
    expect(gradeAnswer(checker([0, -0.1]), "nope")).toBeNull();
  });
});

describe("doubler options and grading", () => {
  it("the five options, in the fixed order", () => {
    expect(doublerOptions(0.5, 0.6, 1).options.map((o) => o.label)).toEqual([
      "No Double / Take",
      "Double / Take",
      "Double / Pass",
      "Too good / Pass",
      "Too good / Take",
    ]);
  });

  it("C2, decision 629849 (ND 0.7922, DT 0.9751, DP 1) -> Double/Take", () => {
    const a = getDecisionAnalysis({ source: "galaxy", raw: ex.cubeDouble.raw }) as CubeAnalysis;
    expect(a).toMatchObject({ role: "doubler", nd: 0.7922, dt: 0.9751, dp: 1 });
    const g = cubeOptions(a);
    expect(g.bestKey).toBe("dt");
    const o = byKey(g.options);
    expect(o.dt).toMatchObject({ correct: true, loss: 0 });
    // Not doubling loses DT − ND = 0.1829.
    expect(o.nd_take).toMatchObject({ correct: false, loss: -0.1829 });
    expect(o.tg_take).toMatchObject({ correct: false, loss: -0.1829 });
    // Doubling right, but pass is wrong by |DT − DP| = 0.0249 > 0.02.
    expect(o.dp).toMatchObject({ correct: false, loss: -0.0249 });
    expect(o.tg_pass).toMatchObject({ correct: false, loss: -0.2078 });
    expect(gradeAnswer(a, "dt")).toEqual({ correct: true, loss: 0 });
    expect(gradeAnswer(a, "dp")?.correct).toBe(false);
  });

  it("too good / pass: ND > DP, DT > DP", () => {
    const g = doublerOptions(1.05, 1.3, 1);
    expect(g.bestKey).toBe("tg_pass");
    const o = byKey(g.options);
    expect(o.tg_pass.correct).toBe(true);
    // Doubling loses ND − DP = 0.05; take is wrong too.
    expect(o.dp).toMatchObject({ correct: false, loss: -0.05 });
    expect(o.dt.correct).toBe(false);
    expect(o.nd_take.correct).toBe(false); // take part wrong by 0.3
  });

  it("too good / take: ND > DP, DT ≤ DP; No Double / Take grades the same (same parts)", () => {
    const g = doublerOptions(1.05, 0.9, 1);
    expect(g.bestKey).toBe("tg_take");
    const o = byKey(g.options);
    expect(o.tg_take.correct).toBe(true);
    expect(o.nd_take.correct).toBe(true);
    expect(o.tg_take.loss).toBe(o.nd_take.loss);
    expect(o.tg_pass.correct).toBe(false); // pass wrong by 0.1
  });

  it("No double / take when DT ≤ ND (both below DP)", () => {
    const g = doublerOptions(0.6, 0.5, 1);
    expect(g.bestKey).toBe("nd_take");
    const o = byKey(g.options);
    expect(o.nd_take).toMatchObject({ correct: true, loss: 0 });
    // Doubling is worth min(DT, DP) = 0.5: 0.1 worse than not doubling.
    expect(o.dt).toMatchObject({ correct: false, loss: -0.1 });
  });

  it("tie DT == ND (< DP): No Double is the label; both No Double and Double/Take grade correct", () => {
    const g = doublerOptions(0.7, 0.7, 1);
    expect(g.bestKey).toBe("nd_take");
    const o = byKey(g.options);
    expect(o.nd_take).toMatchObject({ correct: true, loss: 0 });
    expect(o.dt).toMatchObject({ correct: true, loss: 0 });
  });

  it("tie ND == DP is not too good: the label is Double/Pass (DT > DP)", () => {
    // 662455-like: ND = DP = 1, DT 2.8281.
    const g = doublerOptions(1, 2.8281, 1);
    expect(g.bestKey).toBe("dp");
    expect(doublerAction(1, 2.8281, 1)).toBe("Double/pass");
    const o = byKey(g.options);
    expect(o.dp.correct).toBe(true);
    // By the parts rule, not doubling loses ND − DP = 0, and pass is right.
    expect(o.tg_pass.correct).toBe(true);
  });

  it("tie DT == DP: the take side; take and pass both within the threshold", () => {
    const g = doublerOptions(0.8, 1, 1);
    expect(g.bestKey).toBe("dt");
    const o = byKey(g.options);
    expect(o.dt.correct).toBe(true);
    expect(o.dp.correct).toBe(true);
    expect(o.dp.loss).toBe(0);
  });

  it("take/pass within the threshold: either answer is right, edge included", () => {
    // |DT − DP| = 0.02 exactly.
    const edge = byKey(doublerOptions(0.5, 0.98, 1).options);
    expect(edge.dt.correct).toBe(true);
    expect(edge.dp.correct).toBe(true);
    expect(edge.dp.loss).toBe(-0.02);
    // 0.0201: only take.
    const over = byKey(doublerOptions(0.5, 0.9799, 1).options);
    expect(over.dp.correct).toBe(false);
  });

  it("doubling-part threshold edges: −0.02 is right, −0.0201 is wrong", () => {
    // Double best by 0.02 (DT 0.9, ND 0.88): not doubling loses 0.02.
    expect(byKey(doublerOptions(0.88, 0.9, 1).options).nd_take.correct).toBe(true);
    expect(byKey(doublerOptions(0.8799, 0.9, 1).options).nd_take.correct).toBe(false);
  });

  it("the best option always grades correct", () => {
    const cases: [number, number, number][] = [
      [0.7922, 0.9751, 1],
      [1.05, 1.3, 1],
      [1.05, 0.9, 1],
      [0.6, 0.5, 1],
      [1, 2.8281, 1],
      [0.8, 1, 1],
      [0.3, 0.4, 0.5],
    ];
    for (const [nd, dt, dp] of cases) {
      const g = doublerOptions(nd, dt, dp);
      expect(byKey(g.options)[g.bestKey].correct).toBe(true);
    }
  });
});

describe("receiver options and grading", () => {
  it("Take and Pass; take right when DT ≤ DP (666976: doubler-view DT 0.2057 ≤ DP 1)", () => {
    const a = getDecisionAnalysis({ source: "galaxy", raw: ex.cubePassNegated.raw }) as CubeAnalysis;
    expect(a.role).toBe("receiver");
    const g = cubeOptions(a);
    expect(g.options.map((o) => o.label)).toEqual(["Take", "Pass"]);
    expect(g.bestKey).toBe("take");
    const o = byKey(g.options);
    expect(o.take).toMatchObject({ correct: true, loss: 0 });
    expect(o.pass.correct).toBe(false);
    expect(o.pass.loss).toBeCloseTo(-(a.dp - a.dt), 4);
  });

  it("pass right when DT > DP (652116, not negated: DT 1.1137 > DP 1)", () => {
    const a = getDecisionAnalysis({ source: "galaxy", raw: ex.cubePassNotNegated.raw }) as CubeAnalysis;
    const g = cubeOptions(a);
    expect(g.bestKey).toBe("pass");
    expect(byKey(g.options).take).toMatchObject({ correct: false, loss: -0.1137 });
  });

  it("within the threshold either is right; DT == DP is Take", () => {
    expect(byKey(receiverOptions(1.02, 1).options).take.correct).toBe(true);
    expect(byKey(receiverOptions(1.0201, 1).options).take.correct).toBe(false);
    expect(receiverOptions(1, 1).bestKey).toBe("take");
  });
});
