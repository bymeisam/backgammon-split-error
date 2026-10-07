import { describe, expect, it } from "vitest";
import { reviewDecisionWhere, reviewFiltersFrom, tagIdFromParam } from "@/lib/review/filters";

const from = (o: Record<string, string>) => reviewFiltersFrom((k) => o[k]);

describe("review filters", () => {
  it("reads params, lowercasing category and severity", () => {
    expect(from({ tag: "3", phase: "ply_1", category: "CUBE", severity: "Blunder" })).toEqual({
      tag: "3",
      phase: "ply_1",
      category: "cube",
      severity: "blunder",
    });
  });

  it("builds the Decision where", () => {
    expect(reviewDecisionWhere(from({}))).toEqual({});
    expect(reviewDecisionWhere(from({ tag: "3", phase: "ply_1", category: "checker", severity: "error" }))).toEqual({
      tags: { some: { tagId: 3 } },
      plyNumber: 1,
      kind: "CHECKER",
      errorSeverity: "ERROR",
    });
    expect(reviewDecisionWhere(from({ phase: "race", category: "bogus" }))).toEqual({ classification: "race" });
  });

  it("tag ids must be positive integers", () => {
    expect(tagIdFromParam("12")).toBe(12);
    expect(tagIdFromParam("0")).toBeUndefined();
    expect(tagIdFromParam("x")).toBeUndefined();
  });
});
