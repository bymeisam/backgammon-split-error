import { describe, expect, it } from "vitest";
import {
  decisionBoardFrame,
  decisionColor,
  decisionCubeState,
  decisionLabels,
  decisionRoll,
  getDecisionAnalysis,
} from "@/lib/analysis";
import { galaxyAnalysis } from "@/lib/analysis/galaxy";
import examples from "@/lib/__fixtures__/analysis/galaxy-analysis-examples.json";

type Example = { decisionId: number; analysedEvent: string; raw: unknown };
const ex = examples as unknown as Record<string, Example>;

describe("getDecisionAnalysis", () => {
  it("dispatches source 'galaxy' to the Galaxy translator", () => {
    for (const name of ["C1", "E1", "cubeDouble", "cubePassNegated", "cubePassNotNegated"]) {
      const { raw } = ex[name];
      const result = getDecisionAnalysis({ source: "galaxy", raw });
      expect(result).not.toBeNull();
      expect(result).toEqual(galaxyAnalysis(raw));
    }
  });

  it("returns null for an unknown source, even with a readable Galaxy payload", () => {
    const { raw } = ex.C1;
    expect(getDecisionAnalysis({ source: "xg", raw })).toBeNull();
    expect(getDecisionAnalysis({ source: "", raw })).toBeNull();
  });

  it("does not modify raw", () => {
    const { raw } = ex.E1;
    const before = JSON.stringify(raw);
    getDecisionAnalysis({ source: "galaxy", raw });
    expect(JSON.stringify(raw)).toBe(before);
  });
});

// The display-value dispatchers: an unknown source gets the neutral "nothing
// known" value from each, never a Galaxy reading of its payload. Their
// Galaxy readings are covered in lib/analysis/galaxyFields.test.ts.
describe("display-value dispatchers", () => {
  it("unknown source -> empty colour/roll, no cube, no labels, an unflipped frame", () => {
    const input = { source: "xg", raw: ex.C1.raw };
    expect(decisionColor(input)).toBe("");
    expect(decisionRoll(input)).toEqual([]);
    expect(decisionCubeState(input)).toBeNull();
    expect(decisionLabels(input)).toBeNull();
    expect(decisionBoardFrame(input)).toEqual({ positionFromOpponent: false, doubleOffer: null, cubeSquareValue: null });
  });

  it("source 'galaxy' reads the payload", () => {
    expect(decisionLabels({ source: "galaxy", raw: ex.C1.raw })).not.toBeNull();
  });
});
