// lib/analysis/galaxy.ts on real local rows (lib/__fixtures__/analysis/
// galaxy-analysis-examples.json, trimmed to the paths the translator reads).
import { describe, expect, it } from "vitest";
import { galaxyAnalysis } from "@/lib/analysis/galaxy";
import type { CheckerAnalysis, DecisionAnalysis } from "@/lib/analysis/types";
import examples from "@/lib/__fixtures__/analysis/galaxy-analysis-examples.json";

type Example = { decisionId: number; analysedEvent: string; raw: unknown };
const ex = examples as unknown as Record<string, Example>;

function translate(name: string): DecisionAnalysis | null {
  return galaxyAnalysis(ex[name].raw);
}

function checker(name: string): CheckerAnalysis {
  const a = translate(name);
  expect(a?.kind).toBe("checker");
  return a as CheckerAnalysis;
}

// [move, rank, loss, played] per candidate, in returned order.
function summary(a: CheckerAnalysis): [string, number, number, boolean][] {
  return a.candidates.map((c) => [c.move, c.rank, c.loss, c.played]);
}

describe("galaxyAnalysis: checker", () => {
  it("C1 (46875560 g4, 4-2, decision 1236446): rank 3 has the best equity and sorts first", () => {
    expect(summary(checker("C1"))).toEqual([
      ["20/14", 3, 0, false],
      ["8/6* 5/1", 1, -0.0063, false],
      ["20/18 8/4", 2, -0.0181, true],
    ]);
  });

  it("C2 (47406300 g5, 3-2, decision 1255547): rank 3 beats rank 1", () => {
    expect(summary(checker("C2"))).toEqual([
      ["6/1", 3, 0, false],
      ["6/4 6/3", 1, -0.0045, false],
      ["20/15", 2, -0.0272, true],
    ]);
  });

  it("C3 (5818762 g1, 3-6, decision 183214): rank 3 beats ranks 1 and 2, whose exact tie keeps rank order", () => {
    expect(summary(checker("C3"))).toEqual([
      ["12/6 4/1", 3, 0, false],
      ["12/6 11/8", 1, -0.0018, true],
      ["12/9 11/5", 2, -0.0018, false],
    ]);
  });

  it("C4 (5643381 g2, 3-6, decision 189112): rank 3 beats tied ranks 1 and 2", () => {
    expect(summary(checker("C4"))).toEqual([
      ["15/9 5/2", 3, 0, false],
      ["15/6", 1, -0.0038, true],
      ["15/9 4/1", 2, -0.0038, false],
    ]);
  });

  it("E1 (33015498 g7, 1-3, decision 668067): 17/14* 4/3* is best; the played rank-1 17/14*/13 loses 0.3089", () => {
    const a = checker("E1");
    expect(a.candidates[0]).toMatchObject({ move: "17/14* 4/3*", rank: 2, equity: 1.7335, loss: 0, played: false });
    const played = a.candidates.find((c) => c.played)!;
    expect(played).toMatchObject({ move: "17/14*/13", rank: 1, equity: 1.4246, loss: -0.3089 });
    expect(a.candidates.at(-1)).toBe(played);
  });

  it("F1 (47816592 g1, 3-3, decision 1257877): the played move appended as rank 4 is kept, last", () => {
    expect(summary(checker("F1"))).toEqual([
      ["24/21(2) 13/10(2)", 1, 0, false],
      ["8/5(2) 6/3(2)", 2, -0.001, false],
      ["24/21(2) 6/3(2)", 3, -0.0142, false],
      ["13/10(2) 6/3(2)", 4, -0.0374, true],
    ]);
  });

  it("maps Galaxy's probabilities to probs (C1's best candidate)", () => {
    const best = checker("C1").candidates[0];
    const rawBest = (
      ex.C1.raw as { reviews: { result: { result: { moves: { notation: string; probabilities: Record<string, number> }[] } } }[] }
    ).reviews[0].result.result.moves.find((m) => m.notation === "20/14")!.probabilities;
    expect(best.probs).toEqual({
      win: rawBest.win,
      winG: rawBest.win_gammon,
      winBG: rawBest.win_backgammon,
      loseG: rawBest.lose_gammon,
      loseBG: rawBest.lose_backgammon,
    });
  });

  it("every loss is <= 0, exactly one candidate is 0-loss first, and the shape is versioned", () => {
    for (const name of ["C1", "C2", "C3", "C4", "E1", "F1"]) {
      const a = checker(name);
      expect(a.v).toBe(1);
      expect(a.source).toBe("galaxy");
      expect(a.candidates[0].loss).toBe(0);
      for (const c of a.candidates) expect(c.loss).toBeLessThanOrEqual(0);
      expect(a.candidates.filter((c) => c.played)).toHaveLength(1);
    }
  });

  it("probs is null when a candidate's probabilities are missing", () => {
    const raw = moveRaw([{ notation: "13/7", rank: 1, equity: 0.1, move_played: true }]);
    expect(galaxyAnalysis(raw)).toEqual({
      v: 1,
      source: "galaxy",
      kind: "checker",
      candidates: [{ move: "13/7", rank: 1, equity: 0.1, loss: 0, played: true, probs: null }],
    });
  });

  it("rounds to 4 decimals, with loss taken from the rounded equities", () => {
    const raw = moveRaw([
      { notation: "a", rank: 1, equity: 0.123456, move_played: false },
      { notation: "b", rank: 2, equity: 0.12344, move_played: true },
    ]);
    const a = galaxyAnalysis(raw) as CheckerAnalysis;
    expect(a.candidates.map((c) => [c.equity, c.loss])).toEqual([
      [0.1235, 0],
      [0.1234, -0.0001],
    ]);
  });

  it("null for unrecognised checker data: no moves, a malformed candidate, or not exactly one played move", () => {
    expect(galaxyAnalysis(moveRaw([]))).toBeNull();
    expect(galaxyAnalysis({ reviews: [{ result: { analysed_event: "move", result: {} } }] })).toBeNull();
    expect(galaxyAnalysis(moveRaw([{ notation: "a", rank: 1, equity: "x", move_played: true }]))).toBeNull();
    expect(galaxyAnalysis(moveRaw([{ notation: "a", rank: 1, equity: 0, move_played: false }]))).toBeNull();
    expect(
      galaxyAnalysis(
        moveRaw([
          { notation: "a", rank: 1, equity: 0, move_played: true },
          { notation: "b", rank: 2, equity: 0, move_played: true },
        ])
      )
    ).toBeNull();
  });
});

describe("galaxyAnalysis: cube", () => {
  it("cube_double (decision 629849): the doubler's own values, role doubler", () => {
    expect(translate("cubeDouble")).toEqual({ v: 1, source: "galaxy", kind: "cube", role: "doubler", nd: 0.7922, dt: 0.9751, dp: 1 });
  });

  it("negated cube_pass (decision 666976, DP −1): flipped to the doubler's view, role receiver", () => {
    expect(translate("cubePassNegated")).toEqual({ v: 1, source: "galaxy", kind: "cube", role: "receiver", nd: 0.3838, dt: 0.2057, dp: 1 });
  });

  it("non-negated cube_pass (decision 652116, match 33002925, DP +1): left as it is", () => {
    expect(translate("cubePassNotNegated")).toEqual({ v: 1, source: "galaxy", kind: "cube", role: "receiver", nd: 0.885, dt: 1.1137, dp: 1 });
  });

  it("never stores -0 (a negated cube_pass with ND 0)", () => {
    const raw = cubeRaw("cube_pass", { no_double: 0, double_take: -0.5, double_pass: -1 });
    const a = galaxyAnalysis(raw);
    expect(a).toEqual({ v: 1, source: "galaxy", kind: "cube", role: "receiver", nd: 0, dt: 0.5, dp: 1 });
    expect(Object.is((a as { nd: number }).nd, -0)).toBe(false);
  });

  it("null when the cube equities are missing", () => {
    const raw = cubeRaw("cube_double", { no_double: 0.5, double_take: null, double_pass: 1 });
    expect(galaxyAnalysis(raw)).toBeNull();
    expect(galaxyAnalysis({ reviews: [{ result: { analysed_event: "cube_pass", result: {} } }] })).toBeNull();
  });
});

describe("galaxyAnalysis: everything else is null", () => {
  it("a resignation (decision 1849)", () => {
    expect(translate("resignation")).toBeNull();
  });

  it("an unknown or missing analysed_event, or a raw without reviews", () => {
    expect(galaxyAnalysis(withEvent(ex.C1.raw, "something_new"))).toBeNull();
    expect(galaxyAnalysis(withEvent(ex.C1.raw, undefined))).toBeNull();
    expect(galaxyAnalysis(null)).toBeNull();
    expect(galaxyAnalysis({})).toBeNull();
    expect(galaxyAnalysis({ reviews: [] })).toBeNull();
  });
});

describe("galaxyAnalysis: the event type comes from raw", () => {
  it("reads reviews[0].result.analysed_event (no longer passed in), matching each fixture's stored event", () => {
    for (const name of ["C1", "E1", "cubeDouble", "cubePassNegated", "resignation"]) {
      const raw = ex[name].raw as { reviews: { result: { analysed_event: string } }[] };
      expect(raw.reviews[0].result.analysed_event).toBe(ex[name].analysedEvent);
    }
    // The same cube payload reads as the doubler's or the receiver's
    // decision depending only on raw's own analysed_event.
    const cube = { no_double: 0.4, double_take: 0.2, double_pass: 1 };
    expect(galaxyAnalysis(cubeRaw("cube_double", cube))).toMatchObject({ role: "doubler" });
    expect(galaxyAnalysis(cubeRaw("cube_pass", cube))).toMatchObject({ role: "receiver" });
  });
});

function moveRaw(moves: unknown[]): unknown {
  return { reviews: [{ result: { analysed_event: "move", result: { moves } } }] };
}

function cubeRaw(analysedEvent: string, cube_analysis: unknown): unknown {
  return { reviews: [{ result: { analysed_event: analysedEvent, result: { cube_analysis } } }] };
}

// A deep copy of `raw` with reviews[0].result.analysed_event replaced
// (or removed), leaving the fixture itself untouched.
function withEvent(raw: unknown, analysedEvent: string | undefined): unknown {
  const copy = JSON.parse(JSON.stringify(raw));
  if (analysedEvent === undefined) delete copy.reviews[0].result.analysed_event;
  else copy.reviews[0].result.analysed_event = analysedEvent;
  return copy;
}
