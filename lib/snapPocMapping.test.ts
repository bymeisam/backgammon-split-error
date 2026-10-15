import { describe, expect, it } from "vitest";
import {
  builderStateToLayout,
  layoutToBuilderState,
  type SnapLayout,
  type SnapOrientation,
  type SnapPoint,
} from "./snapPocLayout";
import { checkerTotal, validateBuilderState } from "./positionBuilder";

const none: SnapPoint = { color: "none", count: 0 };
const L = (count: number): SnapPoint => ({ color: "light", count });
const D = (count: number): SnapPoint => ({ color: "dark", count });

// Dark: 2 on the bottom row's far right, 5 on the bottom-left corner, 3 on
// the top-left corner, 4 on the bar side of the top-right half, 1 on the bar.
// Light: 6 on the top row's far right, 6 on the top-left half's bar side,
// 2 borne off, 1 on the bar.
function layout(): SnapLayout {
  return {
    topRow: [D(3), none, none, none, none, L(6), D(4), none, none, none, none, L(6)],
    bottomRow: [D(5), none, none, none, none, none, none, none, none, none, none, D(2)],
    bar: { light: 1, dark: 1 },
    borneOff: { light: 2, dark: 0 },
    dice: [2, 5],
    cube: { visible: true, value: 4, location: "top" },
    barSide: "middle",
    confidence: "high",
    notes: "",
  };
}

describe("layoutToBuilderState", () => {
  it("dark bottom, home right: bottom row reads 12..1, top 13..24", () => {
    const s = layoutToBuilderState(layout(), { bottomColor: "dark", bottomHome: "right" });
    expect(s.position.mine[0]).toBe(2); // bottom rightmost = point 1
    expect(s.position.mine[11]).toBe(5); // bottom leftmost = point 12
    expect(s.position.mine[12]).toBe(3); // top leftmost = point 13
    expect(s.position.mine[18]).toBe(4); // top index 6 = point 19
    expect(s.position.opponent[17]).toBe(6); // top index 5 = point 18
    expect(s.position.opponent[23]).toBe(6); // top rightmost = point 24
    expect(s.position.mineBar).toBe(1);
    expect(s.position.opponentBar).toBe(1);
    expect(s.position.opponentOff).toBe(2);
    expect(s.position.mineOff).toBe(0);
    expect(s.roll).toEqual([5, 2]);
    expect(s.decisionType).toBe("checker");
    expect(s.cubeOwner).toBe("opponent");
    expect(s.cubeValue).toBe(4);
    expect(validateBuilderState(s)).toEqual([]);
  });

  it("dark bottom, home left: bottom row reads 1..12, top 24..13", () => {
    const s = layoutToBuilderState(layout(), { bottomColor: "dark", bottomHome: "left" });
    expect(s.position.mine[11]).toBe(2); // bottom rightmost = point 12
    expect(s.position.mine[0]).toBe(5); // bottom leftmost = point 1
    expect(s.position.mine[23]).toBe(3); // top leftmost = point 24
    expect(s.position.mine[17]).toBe(4); // top index 6 = point 18
    expect(s.position.opponent[18]).toBe(6); // top index 5 = point 19
    expect(s.position.opponent[12]).toBe(6); // top rightmost = point 13
    expect(validateBuilderState(s)).toEqual([]);
  });

  it("light bottom, home right: light is mine", () => {
    const s = layoutToBuilderState(layout(), { bottomColor: "light", bottomHome: "right" });
    expect(s.position.mine[17]).toBe(6);
    expect(s.position.mine[23]).toBe(6);
    expect(s.position.opponent[0]).toBe(2);
    expect(s.position.opponent[11]).toBe(5);
    expect(s.position.opponent[12]).toBe(3);
    expect(s.position.opponent[18]).toBe(4);
    expect(s.position.mineOff).toBe(2);
    expect(s.position.opponentOff).toBe(0);
    expect(s.cubeOwner).toBe("opponent"); // "top" is the top side whatever its colour
    expect(validateBuilderState(s)).toEqual([]);
  });

  it("light bottom, home left", () => {
    const s = layoutToBuilderState(layout(), { bottomColor: "light", bottomHome: "left" });
    expect(s.position.mine[18]).toBe(6);
    expect(s.position.mine[12]).toBe(6);
    expect(s.position.opponent[11]).toBe(2);
    expect(s.position.opponent[0]).toBe(5);
    expect(s.position.opponent[23]).toBe(3);
    expect(s.position.opponent[17]).toBe(4);
    expect(validateBuilderState(s)).toEqual([]);
  });

  it("no dice -> cube decision; hidden or 64 cube -> centred at 1; odd value clamps", () => {
    const l = layout();
    l.dice = [3];
    l.cube = { visible: false, value: 64, location: "unknown" };
    let s = layoutToBuilderState(l, { bottomColor: "dark", bottomHome: "right" });
    expect(s.roll).toBeNull();
    expect(s.decisionType).toBe("cube");
    expect([s.cubeValue, s.cubeOwner]).toEqual([1, "center"]);
    l.cube = { visible: true, value: 3, location: "bottom" };
    s = layoutToBuilderState(l, { bottomColor: "dark", bottomHome: "right" });
    expect([s.cubeValue, s.cubeOwner]).toEqual([2, "mine"]);
  });

  it("keeps each side at 15 even when the reading isn't", () => {
    const l = layout();
    l.bottomRow[0] = D(7); // dark now has 17 on the board
    const s = layoutToBuilderState(l, { bottomColor: "dark", bottomHome: "right" });
    expect(checkerTotal(s.position, "mine")).toBe(15);
    expect(s.position.mineOff).toBe(-2);
    expect(validateBuilderState(s).length).toBeGreaterThan(0);
  });
});

describe("builderStateToLayout", () => {
  const orientations: SnapOrientation[] = [
    { bottomColor: "dark", bottomHome: "right" },
    { bottomColor: "dark", bottomHome: "left" },
    { bottomColor: "light", bottomHome: "right" },
    { bottomColor: "light", bottomHome: "left" },
  ];
  for (const o of orientations) {
    it(`round-trips a layout (${o.bottomColor} bottom, home ${o.bottomHome})`, () => {
      const original = layout();
      const back = builderStateToLayout(layoutToBuilderState(original, o), o);
      expect(back.topRow).toEqual(original.topRow);
      expect(back.bottomRow).toEqual(original.bottomRow);
      expect(back.bar).toEqual(original.bar);
      expect(back.borneOff).toEqual(original.borneOff);
      expect(back.dice).toEqual([5, 2]);
      expect(back.cube).toEqual(original.cube);
    });
  }
});
