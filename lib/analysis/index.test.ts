import { describe, expect, it } from "vitest";
import { getDecisionAnalysis } from "@/lib/analysis";
import { galaxyAnalysis } from "@/lib/analysis/galaxy";
import examples from "@/lib/__fixtures__/analysis/galaxy-analysis-examples.json";

type Example = { decisionId: number; analysedEvent: string; raw: unknown };
const ex = examples as unknown as Record<string, Example>;

describe("getDecisionAnalysis", () => {
  it("dispatches source 'galaxy' to the Galaxy translator", () => {
    for (const name of ["C1", "E1", "cubeDouble", "cubePassNegated", "cubePassNotNegated"]) {
      const { raw, analysedEvent } = ex[name];
      const result = getDecisionAnalysis({ source: "galaxy", raw, analysedEvent });
      expect(result).not.toBeNull();
      expect(result).toEqual(galaxyAnalysis(raw, analysedEvent));
    }
  });

  it("returns null for an unknown source, even with a readable Galaxy payload", () => {
    const { raw, analysedEvent } = ex.C1;
    expect(getDecisionAnalysis({ source: "xg", raw, analysedEvent })).toBeNull();
    expect(getDecisionAnalysis({ source: "", raw, analysedEvent })).toBeNull();
  });

  it("does not modify raw", () => {
    const { raw, analysedEvent } = ex.E1;
    const before = JSON.stringify(raw);
    getDecisionAnalysis({ source: "galaxy", raw, analysedEvent });
    expect(JSON.stringify(raw)).toBe(before);
  });
});
