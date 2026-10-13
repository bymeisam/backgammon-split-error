import { describe, expect, it } from "vitest";
import { forumAnalysisFrom, forumPostAnalyses } from "@/lib/forumAnalysis";
import { getDecisionAnalysis } from "@/lib/analysis";
import type { CheckerAnalysis, CubeAnalysis } from "@/lib/analysis/types";
import examples from "@/lib/__fixtures__/analysis/galaxy-analysis-examples.json";

type Example = { decisionId: number; analysedEvent: string; raw: unknown };
const ex = examples as unknown as Record<string, Example>;

const checker: CheckerAnalysis = {
  v: 1,
  source: "galaxy",
  kind: "checker",
  candidates: [
    { move: "13/7 8/7", rank: 1, equity: 0.25, loss: 0, played: false, probs: null },
    { move: "24/18 13/8", rank: 3, equity: 0.21, loss: -0.04, played: true, probs: null },
    {
      move: "24/13",
      rank: 2,
      equity: 0.1,
      loss: -0.15,
      played: false,
      probs: { win: 0.5, winG: 0.1, winBG: 0, loseG: 0.1, loseBG: 0 },
    },
  ],
};

function cube(role: CubeAnalysis["role"], nd: number, dt: number, dp: number): CubeAnalysis {
  return { v: 1, source: "galaxy", kind: "cube", role, nd, dt, dp };
}

describe("forumAnalysisFrom", () => {
  it("null in, null out", () => {
    expect(forumAnalysisFrom(null)).toBeNull();
  });

  it("checker: best first, losses kept, nothing about the played move", () => {
    const result = forumAnalysisFrom(checker);
    expect(result).toEqual({
      kind: "checker",
      options: [
        { move: "13/7 8/7", equity: 0.25, loss: 0 },
        { move: "24/18 13/8", equity: 0.21, loss: -0.04 },
        { move: "24/13", equity: 0.1, loss: -0.15 },
      ],
    });
    const json = JSON.stringify(result);
    expect(json).not.toContain("played");
    expect(json).not.toContain("probs");
    expect(json).not.toContain("rank");
    expect(json).not.toContain("true");
  });

  it("checker from a real payload: no played key, best first, loss = equity − best", () => {
    let checked = 0;
    for (const name of ["C1", "E1"]) {
      const analysis = getDecisionAnalysis({ source: "galaxy", raw: ex[name].raw });
      if (analysis?.kind !== "checker") continue;
      checked++;
      expect(analysis.candidates.some((c) => c.played)).toBe(true);
      const result = forumAnalysisFrom(analysis);
      if (result?.kind !== "checker") throw new Error("expected a checker result");
      expect(JSON.stringify(result)).not.toContain("played");
      const best = result.options[0];
      expect(best.loss).toBe(0);
      for (const option of result.options) {
        expect(Object.keys(option).sort()).toEqual(["equity", "loss", "move"]);
        expect(option.equity).toBeLessThanOrEqual(best.equity);
        expect(option.loss).toBeCloseTo(option.equity - best.equity, 9);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("cube, doubler: the doubler's best label and cell", () => {
    expect(forumAnalysisFrom(cube("doubler", 0.5, 0.7, 1))).toMatchObject({
      kind: "cube",
      best: "Double",
      bestDetail: "opponent should take",
      bestCell: "dt",
    });
    expect(forumAnalysisFrom(cube("doubler", 0.5, 0.4, 1))).toMatchObject({
      best: "No Double",
      bestDetail: null,
      bestCell: "nd",
    });
    expect(forumAnalysisFrom(cube("doubler", 0.8, 1.2, 1))).toMatchObject({
      best: "Double",
      bestDetail: "opponent should pass",
      bestCell: "dp",
    });
    expect(forumAnalysisFrom(cube("doubler", 1.1, 1.3, 1))).toMatchObject({
      best: "Too good",
      bestDetail: "opponent should pass",
      bestCell: "nd",
    });
  });

  it("cube, receiver: Take or Pass, never the doubler's label", () => {
    expect(forumAnalysisFrom(cube("receiver", 0.5, 0.7, 1))).toMatchObject({
      best: "Take",
      bestDetail: null,
      bestCell: "dt",
    });
    expect(forumAnalysisFrom(cube("receiver", 0.8, 1.2, 1))).toMatchObject({
      best: "Pass",
      bestDetail: null,
      bestCell: "dp",
    });
  });

  it("cube: keeps the equities, drops the role", () => {
    const result = forumAnalysisFrom(cube("receiver", 0.5, 0.7, 1));
    expect(result).toEqual({
      kind: "cube",
      nd: 0.5,
      dt: 0.7,
      dp: 1,
      best: "Take",
      bestDetail: null,
      bestCell: "dt",
    });
    expect(JSON.stringify(result)).not.toContain("role");
  });

  it("cube from real payloads", () => {
    for (const name of ["cubeDouble", "cubePassNegated", "cubePassNotNegated"]) {
      const analysis = getDecisionAnalysis({ source: "galaxy", raw: ex[name].raw });
      const result = forumAnalysisFrom(analysis);
      expect(result?.kind).toBe("cube");
      expect(JSON.stringify(result)).not.toContain("role");
    }
  });
});

describe("forumPostAnalyses", () => {
  const sources = [{ source: "galaxy", raw: ex.C1.raw }, null, { source: "galaxy", raw: ex.cubeDouble.raw }];

  it("hideAnalysis: no analysis for any position", () => {
    expect(forumPostAnalyses(true, sources)).toEqual([null, null, null]);
  });

  it("otherwise: analysis for game positions, none for built ones or unknown sources", () => {
    const result = forumPostAnalyses(false, [...sources, { source: "xg", raw: ex.C1.raw }]);
    expect(result[0]).not.toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]?.kind).toBe("cube");
    expect(result[3]).toBeNull();
  });
});
