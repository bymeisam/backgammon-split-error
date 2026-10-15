import { describe, expect, it } from "vitest";
import type { SnapLayout, SnapPoint } from "./snapPocLayout";
import { scoreSnap } from "./snapPocScore";

const none: SnapPoint = { color: "none", count: 0 };
const L = (count: number): SnapPoint => ({ color: "light", count });
const D = (count: number): SnapPoint => ({ color: "dark", count });

function truth(): SnapLayout {
  return {
    topRow: [D(3), none, none, none, none, L(6), D(4), none, none, none, none, L(7)],
    bottomRow: [D(5), none, none, none, L(2), none, none, none, none, none, none, D(3)],
    bar: { light: 0, dark: 0 },
    borneOff: { light: 0, dark: 0 },
    dice: [2, 5],
    cube: { visible: true, value: 1, location: "center" },
    barSide: "middle",
    confidence: "high",
    notes: "",
  };
}

describe("scoreSnap", () => {
  it("identical layouts score perfectly", () => {
    const s = scoreSnap(truth(), truth());
    expect(s).toEqual({
      pointsExact: 24,
      checkersOff: 0,
      barOk: true,
      offOk: true,
      diceOk: true,
      cubeOk: true,
      bestSymmetry: "identity",
      pointsExactBest: 24,
    });
  });

  it("dice order and a hidden vs centred cube don't count against it", () => {
    const g = truth();
    g.dice = [5, 2];
    g.cube = { visible: false, value: 64, location: "unknown" };
    const s = scoreSnap(g, truth());
    expect(s.diceOk).toBe(true);
    expect(s.cubeOk).toBe(true);
  });

  it("one checker moved costs two points and two checkers", () => {
    const g = truth();
    g.topRow[0] = D(2);
    g.topRow[1] = D(1);
    const s = scoreSnap(g, truth());
    expect(s.pointsExact).toBe(22);
    expect(s.checkersOff).toBe(2);
    expect(s.bestSymmetry).toBe("identity");
  });

  it("a colour swap on one point costs both colours", () => {
    const g = truth();
    g.bottomRow[4] = D(2);
    const s = scoreSnap(g, truth());
    expect(s.pointsExact).toBe(23);
    expect(s.checkersOff).toBe(4);
  });

  it("a mirrored read is found as the best symmetry", () => {
    const g = truth();
    g.topRow = [...g.topRow].reverse();
    g.bottomRow = [...g.bottomRow].reverse();
    const s = scoreSnap(g, truth());
    expect(s.pointsExact).toBeLessThan(24);
    expect(s.bestSymmetry).toBe("mirror");
    expect(s.pointsExactBest).toBe(24);
  });

  it("a flipped read is found too", () => {
    const g = truth();
    [g.topRow, g.bottomRow] = [g.bottomRow, g.topRow];
    const s = scoreSnap(g, truth());
    expect(s.bestSymmetry).toBe("flip");
    expect(s.pointsExactBest).toBe(24);
  });

  it("wrong bar, tray and cube are flagged", () => {
    const g = truth();
    g.bar = { light: 1, dark: 0 };
    g.borneOff = { light: 0, dark: 2 };
    g.cube = { visible: true, value: 2, location: "top" };
    g.dice = [3, 5];
    const s = scoreSnap(g, truth());
    expect([s.barOk, s.offOk, s.cubeOk, s.diceOk]).toEqual([false, false, false, false]);
  });
});
