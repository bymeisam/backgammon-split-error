import { describe, expect, it } from "vitest";
import type { SnapScore } from "../../lib/snapPocScore";
import { isPerfect, renderPerPhoto, renderSetTable, summarizeRun, type ScoredAnswer } from "./scoreTable";

function score(over: Partial<SnapScore> = {}): SnapScore {
  return {
    pointsExact: 24,
    checkersOff: 0,
    barOk: true,
    offOk: true,
    diceOk: true,
    cubeOk: true,
    bestSymmetry: "identity",
    pointsExactBest: 24,
    ...over,
  };
}

const answers: ScoredAnswer[] = [
  { run: "m/v1", image: "a.png", score: score() },
  { run: "m/v1", image: "b.png", score: score({ pointsExact: 18, diceOk: false }) },
  { run: "m/v1", image: "c.png", score: null },
  { run: "m/v2", image: "a.png", score: score({ offOk: false }) },
  { run: "m/v2", image: "b.png", score: score() },
];

describe("snaps score aggregation", () => {
  it("needs every part right for a perfect board", () => {
    expect(isPerfect(score())).toBe(true);
    expect(isPerfect(score({ pointsExact: 23 }))).toBe(false);
    expect(isPerfect(score({ cubeOk: false }))).toBe(false);
  });

  it("counts parse errors as scored with 0 points", () => {
    expect(summarizeRun("m/v1", answers)).toEqual({
      run: "m/v1",
      scored: 3,
      perfect: 1,
      allPoints: 1,
      avgPoints: 14,
      dice: 1,
      bar: 2,
      cube: 2,
      tray: 2,
      parseErrors: 1,
    });
  });

  it("renders a row per run within the set only", () => {
    const set = { name: "s", description: "a and b", includes: (i: string) => i !== "c.png" };
    const table = renderSetTable(set, ["m/v1", "m/v2", "m/v3"], answers);
    expect(table).toContain("| m/v1 | 2 | 1/2 | 1/2 | 21.0 (88%) | 1/2 | 2/2 | 2/2 | 2/2 | 0 |");
    expect(table).toContain("| m/v2 | 2 | 1/2 | 2/2 | 24.0 (100%) | 2/2 | 2/2 | 2/2 | 1/2 | 0 |");
    expect(table).not.toContain("m/v3");
  });

  it("lists per photo which runs were perfect", () => {
    const table = renderPerPhoto(["m/v1", "m/v2"], answers);
    expect(table).toContain("| a.png | 24/24 ✓ | 24/24 | m/v1 |");
    expect(table).toContain("| b.png | 18/24 | 24/24 ✓ | m/v2 |");
    expect(table).toContain("| c.png | parse error | – | none |");
  });
});
