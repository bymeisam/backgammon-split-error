import { describe, expect, it } from "vitest";
import { readAnalysis } from "@/lib/analysis/read";
import { galaxyAnalysis } from "@/lib/analysis/galaxy";
import examples from "@/lib/__fixtures__/analysis/galaxy-analysis-examples.json";

type Example = { analysedEvent: string; raw: unknown };
const ex = examples as unknown as Record<string, Example>;

const CHECKER = {
  v: 1,
  source: "galaxy",
  kind: "checker",
  candidates: [
    { move: "17/14* 4/3*", rank: 2, equity: 1.7335, loss: 0, played: false, probs: null },
    {
      move: "17/14*/13",
      rank: 1,
      equity: 1.4246,
      loss: -0.3089,
      played: true,
      probs: { win: 0.8, winG: 0.3, winBG: 0.01, loseG: 0.02, loseBG: 0 },
    },
  ],
};
const CUBE = { v: 1, source: "galaxy", kind: "cube", role: "receiver", nd: 0.3838, dt: 0.2057, dp: 1 };

describe("readAnalysis", () => {
  it("accepts every translator output on the real examples (round trip)", () => {
    for (const name of ["C1", "C2", "C3", "C4", "E1", "F1", "cubeDouble", "cubePassNegated", "cubePassNotNegated"]) {
      const a = galaxyAnalysis(ex[name].raw, ex[name].analysedEvent);
      expect(a).not.toBeNull();
      expect(readAnalysis(JSON.parse(JSON.stringify(a)))).toEqual(a);
    }
  });

  it("accepts a valid checker and cube value, and JSON text", () => {
    expect(readAnalysis(CHECKER)).toEqual(CHECKER);
    expect(readAnalysis(CUBE)).toEqual(CUBE);
    expect(readAnalysis(JSON.stringify(CUBE))).toEqual(CUBE);
  });

  it("returns only the known fields", () => {
    expect(readAnalysis({ ...CUBE, extra: 1 })).toEqual(CUBE);
  });

  it("null for missing values", () => {
    expect(readAnalysis(null)).toBeNull();
    expect(readAnalysis(undefined)).toBeNull();
    expect(readAnalysis("not json")).toBeNull();
    expect(readAnalysis([])).toBeNull();
  });

  it("null for a wrong or unknown version, source or kind", () => {
    expect(readAnalysis({ ...CUBE, v: 2 })).toBeNull();
    expect(readAnalysis({ ...CUBE, v: "1" })).toBeNull();
    expect(readAnalysis({ ...CUBE, v: undefined })).toBeNull();
    expect(readAnalysis({ ...CUBE, source: "xg" })).toBeNull();
    expect(readAnalysis({ ...CUBE, kind: "resignation" })).toBeNull();
  });

  it("null for a malformed cube value", () => {
    expect(readAnalysis({ ...CUBE, role: "taker" })).toBeNull();
    expect(readAnalysis({ ...CUBE, dp: null })).toBeNull();
    expect(readAnalysis({ ...CUBE, nd: "0.3" })).toBeNull();
  });

  it("null for malformed checker candidates", () => {
    const [best, played] = CHECKER.candidates;
    expect(readAnalysis({ ...CHECKER, candidates: [] })).toBeNull();
    expect(readAnalysis({ ...CHECKER, candidates: "x" })).toBeNull();
    expect(readAnalysis({ ...CHECKER, candidates: [{ ...best, move: 3 }, played] })).toBeNull();
    expect(readAnalysis({ ...CHECKER, candidates: [{ ...best, loss: 0.1 }, played] })).toBeNull();
    expect(readAnalysis({ ...CHECKER, candidates: [{ ...best, played: "no" }, played] })).toBeNull();
    expect(readAnalysis({ ...CHECKER, candidates: [{ ...best, probs: { win: 1 } }, played] })).toBeNull();
    expect(readAnalysis({ ...CHECKER, candidates: [{ ...best, probs: undefined }, played] })).toBeNull();
    // Not exactly one played candidate.
    expect(readAnalysis({ ...CHECKER, candidates: [best] })).toBeNull();
    expect(readAnalysis({ ...CHECKER, candidates: [{ ...best, played: true }, played] })).toBeNull();
  });
});
