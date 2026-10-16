import { describe, expect, it } from "vitest";
import {
  boardHomeLeft,
  builderStateToLayout,
  layoutToBuilderState,
  mirrorLayout,
  rotateLayout180,
  toggleMirrorCheckers,
  toggleRotate,
  type SnapLayout,
  type SnapOrientation,
  type SnapPoint,
} from "./snapPocLayout";
import { checkerTotal, validateBuilderState } from "./positionBuilder";
import { stackBase } from "./boardGeometry";
import { isSnapOrientation } from "./snapPocFiles";

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

// Every drawn stack as "row@x:side×count", sorted, at its absolute x.
// Board draws point p at stackBase(p, homeLeft).cx, with
// homeLeft = boardHomeLeft(o) on /snap-poc.
function screen(o: SnapOrientation): string[] {
  const { position } = layoutToBuilderState(layout(), o);
  const out: string[] = [];
  for (let p = 1; p <= 24; p++) {
    const x = stackBase(p, boardHomeLeft(o)).cx;
    const row = p <= 12 ? "bottom" : "top";
    if (position.mine[p - 1]) out.push(`${row}@${x}:mine×${position.mine[p - 1]}`);
    if (position.opponent[p - 1]) out.push(`${row}@${x}:opponent×${position.opponent[p - 1]}`);
  }
  return out.sort();
}

// Step 1's "Mirror checkers": the layout is read mirrored left to right.
describe("mirror checkers", () => {
  const base: SnapOrientation[] = [
    { bottomColor: "dark", bottomHome: "right" },
    { bottomColor: "light", bottomHome: "left" },
    { bottomColor: "dark", bottomHome: "left", rotated: true },
  ];

  it("mirrorLayout reverses both rows and keeps the rest; its own inverse", () => {
    const m = mirrorLayout(layout());
    expect(m.topRow).toEqual([...layout().topRow].reverse());
    expect(m.bottomRow).toEqual([...layout().bottomRow].reverse());
    expect({ ...m, topRow: [], bottomRow: [] }).toEqual({ ...layout(), topRow: [], bottomRow: [] });
    expect(mirrorLayout(m)).toEqual(layout());
  });

  for (const o of base) {
    const label = `${o.bottomColor} bottom, home ${o.bottomHome}${o.rotated ? ", rotated" : ""}`;

    it(`moves the checkers on screen, keeps the home side and colour (${label})`, () => {
      const next = toggleMirrorCheckers(o);
      expect(next.layoutMirrored).toBe(true);
      expect(next.bottomHome).toBe(o.bottomHome);
      expect(next.bottomColor).toBe(o.bottomColor);
      expect(boardHomeLeft(next)).toBe(boardHomeLeft(o));
      expect(screen(next)).not.toEqual(screen(o));
    });

    it(`stores the layout in the photo's frame (${label})`, () => {
      const next = toggleMirrorCheckers(o);
      const back = builderStateToLayout(layoutToBuilderState(layout(), next), next);
      expect(back.topRow).toEqual(layout().topRow);
      expect(back.bottomRow).toEqual(layout().bottomRow);
    });
  }

  it("reads a file saved with the retired mirroredNumbers exactly as without it", () => {
    const old: SnapOrientation = { bottomColor: "dark", bottomHome: "left" };
    expect(isSnapOrientation(old)).toBe(true);
    expect(isSnapOrientation({ ...old, mirroredNumbers: true })).toBe(true);
    expect(isSnapOrientation({ ...old, mirroredNumbers: "yes" })).toBe(false);
    expect(isSnapOrientation({ ...old, layoutMirrored: true, analyzingFor: "light" })).toBe(true);
    expect(isSnapOrientation({ ...old, layoutMirrored: "yes" })).toBe(false);
    expect(isSnapOrientation({ ...old, analyzingFor: "white" })).toBe(false);
    expect(layoutToBuilderState(layout(), { ...old, mirroredNumbers: true })).toEqual(
      layoutToBuilderState(layout(), old)
    );
  });
});

// "Rotate board": the board viewed from the other side of the table.
describe("rotate board", () => {
  const all: SnapOrientation[] = [];
  for (const bottomColor of ["dark", "light"] as const)
    for (const bottomHome of ["right", "left"] as const)
      for (const layoutMirrored of [false, true]) all.push({ bottomColor, bottomHome, layoutMirrored });

  it("rotateLayout180 swaps and reverses the rows and flips a top/bottom cube", () => {
    const r = rotateLayout180(layout());
    expect(r.topRow).toEqual([...layout().bottomRow].reverse());
    expect(r.bottomRow).toEqual([...layout().topRow].reverse());
    expect(r.cube).toEqual({ visible: true, value: 4, location: "bottom" });
    expect(r.bar).toEqual(layout().bar);
    expect(r.borneOff).toEqual(layout().borneOff);
    expect(r.dice).toEqual(layout().dice);
    const centred = { ...layout(), cube: { visible: true, value: 1, location: "center" as const } };
    expect(rotateLayout180(centred).cube.location).toBe("center");
  });

  it("is its own inverse", () => {
    expect(rotateLayout180(rotateLayout180(layout()))).toEqual(layout());
  });

  for (const o of all) {
    const rotated = toggleRotate(o);
    const label = `${o.bottomColor} bottom, home ${o.bottomHome}, ${o.layoutMirrored ? "mirrored" : "plain"}`;

    it(`round-trips the photo layout with rotation on (${label})`, () => {
      const back = builderStateToLayout(layoutToBuilderState(layout(), rotated), rotated);
      const original = layout();
      expect(back.topRow).toEqual(original.topRow);
      expect(back.bottomRow).toEqual(original.bottomRow);
      expect(back.bar).toEqual(original.bar);
      expect(back.borneOff).toEqual(original.borneOff);
      expect(back.cube).toEqual(original.cube);
    });

    it(`reads the upside-down photo with colour and home side swapped, leaving Mirror checkers alone (${label})`, () => {
      expect(rotated.rotated).toBe(true);
      expect(rotated.bottomColor).not.toBe(o.bottomColor);
      expect(rotated.bottomHome).toBe(o.bottomHome);
      expect(rotated.layoutMirrored).toBe(o.layoutMirrored);
      expect(toggleRotate(rotated)).toEqual({ ...o, rotated: false });
      expect(layoutToBuilderState(layout(), rotated)).toEqual(
        layoutToBuilderState(rotateLayout180(layout()), {
          ...o,
          bottomColor: rotated.bottomColor,
          bottomHome: o.bottomHome === "right" ? "left" : "right",
        })
      );
      // The drawing changes: the other colour is now at the bottom, so each
      // stack moves to the other row (same column, numbers unchanged).
      expect(screen(rotated)).not.toEqual(screen(o));
    });

    it(`combines with Mirror checkers (${label})`, () => {
      // The toggles commute, and the saved photo layout is the same whichever
      // order they were pressed in.
      for (const toggle of [toggleMirrorCheckers]) {
        const a = toggleRotate(toggle(o));
        const b = toggle(toggleRotate(o));
        expect(a).toEqual(b);
        expect(builderStateToLayout(layoutToBuilderState(layout(), a), a)).toEqual(
          builderStateToLayout(layoutToBuilderState(layout(), b), b)
        );
      }
    });
  }

  it("a file saved without rotated loads exactly as before", () => {
    const old: SnapOrientation = { bottomColor: "dark", bottomHome: "left" };
    expect(isSnapOrientation({ ...old, rotated: true })).toBe(true);
    expect(isSnapOrientation({ ...old, rotated: 1 })).toBe(false);
    expect(layoutToBuilderState(layout(), old)).toEqual(layoutToBuilderState(layout(), { ...old, rotated: false }));
  });
});
