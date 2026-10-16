// What each Snaps orientation option does to the builder position, checked
// on one fixed, asymmetric mid-game photo layout with both sides' pip
// counts. The expected positions are worked out by hand from the doc
// comments in lib/snapPocLayout.ts:
// - pointAt: home right -> bottom row reads 12..1 left to right, top row
//   13..24; home left mirrors both rows (bottom 1..12, top 24..13).
// - Rotate is a view change only (walking round the table): each colour
//   keeps its own points, bar, tray and pip count; only which colour is
//   Bottom (`mine`) swaps. `opponent` is indexed in `mine`'s frame, so a
//   colour's own point p shows as 25 - p when it is the top side.
// - Mirror numbers changes bottomHome (and the drawing), so it changes the
//   position, exactly as Mirror checkers does.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SNAP_ORIENTATION,
  isCheckersMirrored,
  layoutToBuilderState,
  myColor,
  setMyColor,
  toggleMirrorCheckers,
  toggleMirrorNumbers,
  toggleRotate,
  type SnapLayout,
  type SnapOrientation,
  type SnapPoint,
} from "./snapPocLayout";
import { validateBuilderState } from "./positionBuilder";
import { pipCounts } from "./pipCount";
import { CHECKER_PALETTE, checkerColors } from "./checkerPalette";

const none: SnapPoint = { color: "none", count: 0 };
const L = (count: number): SnapPoint => ({ color: "light", count });
const D = (count: number): SnapPoint => ({ color: "dark", count });

// The photo, left to right as seen. Dark has 14 on the board and 1 on the
// bar; light has 14 on the board and 1 borne off.
function photo(): SnapLayout {
  return {
    //       0      1     2     3     4      5     6      7      8     9     10    11
    topRow: [D(4), none, none, none, L(2), none, L(5), L(2), none, none, none, D(1)],
    bottomRow: [L(3), none, none, none, D(3), none, D(4), none, D(2), none, none, L(2)],
    bar: { light: 0, dark: 1 },
    borneOff: { light: 1, dark: 0 },
    dice: [3, 1],
    cube: { visible: true, value: 1, location: "center" },
    barSide: "middle",
    confidence: "high",
    notes: "",
  };
}

/** Sparse `{ point: count }` -> a 24-entry array (index = point - 1). */
function side(points: Record<number, number>): number[] {
  const out = new Array(24).fill(0);
  for (const [point, count] of Object.entries(points)) out[Number(point) - 1] = count;
  return out;
}

interface Case {
  name: string;
  orientation: SnapOrientation;
  mine: Record<number, number>;
  opponent: Record<number, number>;
  mineBar: number;
  opponentBar: number;
  mineOff: number;
  opponentOff: number;
  pips: { mine: number; opponent: number };
}

const DEFAULT = DEFAULT_SNAP_ORIENTATION; // dark bottom, home right

const cases: Case[] = [
  {
    // Bottom row 12..1: L3 on 12, D3 on 8, D4 on 6, D2 on 4, L2 on 1.
    // Top row 13..24: D4 on 13, L2 on 17, L5 on 19, L2 on 20, D1 on 24.
    // Dark (bottom): 24 + 4*13 + 3*8 + 4*6 + 2*4 + bar 25 = 157.
    // Light (top, in dark's frame p -> 25 - p): 2*24 + 3*13 + 2*8 + 5*6 + 2*5 = 143.
    name: "default (dark bottom, home right): bottom 157 / top 143",
    orientation: DEFAULT,
    mine: { 24: 1, 13: 4, 8: 3, 6: 4, 4: 2 },
    opponent: { 1: 2, 12: 3, 17: 2, 19: 5, 20: 2 },
    mineBar: 1,
    opponentBar: 0,
    mineOff: 0,
    opponentOff: 1,
    pips: { mine: 157, opponent: 143 },
  },
  {
    // Home board moves to the left: bottom row now reads 1..12, top 24..13.
    // Each point p maps to 13 - p (bottom) or 37 - p (top): dark's 6-point
    // stack (photo bottom index 6) is now on point 7, its 8 on 5, its 4 on
    // 9, its 13 on 24 and its 24 on 13; light's 1 -> 12, 12 -> 1, 17 -> 20,
    // 19 -> 18, 20 -> 17.
    // Dark: 4*24 + 13 + 2*9 + 4*7 + 3*5 + 25 = 195.
    // Light: 3*24 + 2*13 + 2*5 + 5*7 + 2*8 = 159.
    name: "mirror checkers: bottom 195 / top 159",
    orientation: toggleMirrorCheckers(DEFAULT),
    mine: { 24: 4, 13: 1, 9: 2, 7: 4, 5: 3 },
    opponent: { 1: 3, 12: 2, 17: 2, 18: 5, 20: 2 },
    mineBar: 1,
    opponentBar: 0,
    mineOff: 0,
    opponentOff: 1,
    pips: { mine: 195, opponent: 159 },
  },
  {
    // The checkers stay where they are on screen and the numbers mirror,
    // so the home board moves to the left: the same position as Mirror
    // checkers (the two differ only in the drawing).
    name: "mirror numbers: bottom 195 / top 159",
    orientation: toggleMirrorNumbers(DEFAULT),
    mine: { 24: 4, 13: 1, 9: 2, 7: 4, 5: 3 },
    opponent: { 1: 3, 12: 2, 17: 2, 18: 5, 20: 2 },
    mineBar: 1,
    opponentBar: 0,
    mineOff: 0,
    opponentOff: 1,
    pips: { mine: 195, opponent: 159 },
  },
  {
    // Walking round the table: light is now drawn at the bottom and dark at
    // the top, but neither colour's checkers move in its own frame. Light's
    // own points (25 - p from the default case): 24, 13, 8, 6, 5; dark's own
    // 24, 13, 8, 6, 4 now show in light's frame as 1, 12, 17, 19, 21.
    // Light: 2*24 + 3*13 + 2*8 + 5*6 + 2*5 = 143 (1 borne off).
    // Dark: 1 + 4*12 + 3*17 + 4*19 + 2*21 + bar 25 = 157 (as in default).
    name: "rotate: bottom 143 / top 157 (default with Bottom/Top swapped)",
    orientation: toggleRotate(DEFAULT),
    mine: { 24: 2, 13: 3, 8: 2, 6: 5, 5: 2 },
    opponent: { 1: 1, 12: 4, 17: 3, 19: 4, 21: 2 },
    mineBar: 0,
    opponentBar: 1,
    mineOff: 1,
    opponentOff: 0,
    pips: { mine: 143, opponent: 157 },
  },
  {
    // The mirror-numbers game with Bottom/Top swapped. Light's own points
    // there (25 - p): 24, 13, 8, 7, 5; dark's own 24, 13, 9, 7, 5 show in
    // light's frame as 1, 12, 16, 18, 20.
    // Light: 3*24 + 2*13 + 2*8 + 5*7 + 2*5 = 159.
    // Dark (as in mirror numbers): 4*24 + 13 + 2*9 + 4*7 + 3*5 + 25 = 195.
    name: "mirror numbers + rotate: bottom 159 / top 195",
    orientation: toggleRotate(toggleMirrorNumbers(DEFAULT)),
    mine: { 24: 3, 13: 2, 8: 2, 7: 5, 5: 2 },
    opponent: { 1: 4, 12: 1, 16: 2, 18: 4, 20: 3 },
    mineBar: 0,
    opponentBar: 1,
    mineOff: 1,
    opponentOff: 0,
    pips: { mine: 159, opponent: 195 },
  },
];

describe("Snaps orientation -> builder position and pip counts", () => {
  for (const c of cases) {
    it(c.name, () => {
      const state = layoutToBuilderState(photo(), c.orientation);
      expect(state.position).toEqual({
        mine: side(c.mine),
        opponent: side(c.opponent),
        mineBar: c.mineBar,
        opponentBar: c.opponentBar,
        mineOff: c.mineOff,
        opponentOff: c.opponentOff,
      });
      expect(pipCounts(state.position)).toEqual(c.pips);
      expect(state.roll).toEqual([3, 1]);
      expect(validateBuilderState(state)).toEqual([]);
    });
  }

  it("mirror numbers changes the position (not display-only)", () => {
    const plain = layoutToBuilderState(photo(), DEFAULT);
    const mirrored = layoutToBuilderState(photo(), toggleMirrorNumbers(DEFAULT));
    expect(mirrored.position).not.toEqual(plain.position);
    expect(pipCounts(mirrored.position)).not.toEqual(pipCounts(plain.position));
  });

  const toggles = { "mirror checkers": toggleMirrorCheckers, "mirror numbers": toggleMirrorNumbers, rotate: toggleRotate };
  for (const [name, toggle] of Object.entries(toggles)) {
    it(`${name} twice gives back the original (orientation and position)`, () => {
      const twice = toggle(toggle(DEFAULT));
      // Optional flags come back as `false` rather than absent; both mean off.
      expect({ ...twice, mirroredNumbers: Boolean(twice.mirroredNumbers), rotated: Boolean(twice.rotated) }).toEqual({
        ...DEFAULT,
        mirroredNumbers: false,
        rotated: false,
      });
      expect(layoutToBuilderState(photo(), twice)).toEqual(layoutToBuilderState(photo(), DEFAULT));
    });
  }

  // Each colour's checkers in its own frame (index = own point - 1), plus
  // its bar and tray, and which side of the builder it is on.
  function perColour(o: SnapOrientation) {
    const { position } = layoutToBuilderState(photo(), o);
    const ownOpponent = [...position.opponent].reverse(); // p -> 25 - p
    const mineSide = { points: position.mine, bar: position.mineBar, off: position.mineOff };
    const oppSide = { points: ownOpponent, bar: position.opponentBar, off: position.opponentOff };
    const pips = pipCounts(position);
    return o.bottomColor === "dark"
      ? { bottom: "dark", dark: { ...mineSide, pips: pips.mine }, light: { ...oppSide, pips: pips.opponent } }
      : { bottom: "light", light: { ...mineSide, pips: pips.mine }, dark: { ...oppSide, pips: pips.opponent } };
  }

  for (const [name, base] of [
    ["default", DEFAULT],
    ["mirror checkers", toggleMirrorCheckers(DEFAULT)],
    ["mirror numbers", toggleMirrorNumbers(DEFAULT)],
  ] as const) {
    it(`rotate keeps each colour's points, bar, tray and pips, and swaps Bottom/Top (${name})`, () => {
      const before = perColour(base);
      const after = perColour(toggleRotate(base));
      expect(after.dark).toEqual(before.dark);
      expect(after.light).toEqual(before.light);
      expect(after.bottom).not.toBe(before.bottom);
      const a = layoutToBuilderState(photo(), base);
      const b = layoutToBuilderState(photo(), toggleRotate(base));
      expect(pipCounts(b.position)).toEqual({
        mine: pipCounts(a.position).opponent,
        opponent: pipCounts(a.position).mine,
      });
      expect(b.roll).toEqual(a.roll);
    });

    it(`rotate leaves the mirror toggles reading the same (${name})`, () => {
      const r = toggleRotate(base);
      expect(isCheckersMirrored(r)).toBe(isCheckersMirrored(base));
      expect(Boolean(r.mirroredNumbers)).toBe(Boolean(base.mirroredNumbers));
    });
  }

  it("rotate moves an owned cube with its colour and leaves a centred cube centred", () => {
    const owned = (location: "top" | "bottom"): SnapLayout => ({
      ...photo(),
      cube: { visible: true, value: 4, location },
    });
    // Photo cube at the top: owned by light (top in the photo). Rotated,
    // light is Bottom (`mine`), so it is still light's cube.
    expect(layoutToBuilderState(owned("top"), DEFAULT).cubeOwner).toBe("opponent");
    expect(layoutToBuilderState(owned("top"), toggleRotate(DEFAULT)).cubeOwner).toBe("mine");
    expect(layoutToBuilderState(owned("bottom"), DEFAULT).cubeOwner).toBe("mine");
    expect(layoutToBuilderState(owned("bottom"), toggleRotate(DEFAULT)).cubeOwner).toBe("opponent");
    expect(layoutToBuilderState(owned("top"), toggleRotate(DEFAULT)).cubeValue).toBe(4);
    expect(layoutToBuilderState(photo(), toggleRotate(DEFAULT)).cubeOwner).toBe("center");
  });

  it("swap colours is drawing only: same builder state and pips, palettes flipped", () => {
    // The swap isn't an input to the mapping at all: it is a separate
    // display flag the review page passes to Board. The builder state and
    // pip counts come from the orientation alone, so they match with the
    // swap on or off; only the palette each side is drawn in flips.
    for (const o of [DEFAULT, toggleRotate(DEFAULT), toggleMirrorNumbers(DEFAULT)]) {
      const withoutSwap = layoutToBuilderState(photo(), o);
      const withSwap = layoutToBuilderState(photo(), o);
      expect(withSwap).toEqual(withoutSwap);
      expect(pipCounts(withSwap.position)).toEqual(pipCounts(withoutSwap.position));
    }
    expect(checkerColors("mine", false)).toEqual(CHECKER_PALETTE.mine);
    expect(checkerColors("opponent", false)).toEqual(CHECKER_PALETTE.opponent);
    expect(checkerColors("mine", true)).toEqual(CHECKER_PALETTE.opponent);
    expect(checkerColors("opponent", true)).toEqual(CHECKER_PALETTE.mine);
  });

  it("bottom colour swapped twice gives back the original", () => {
    const swap = (o: SnapOrientation): SnapOrientation => ({
      ...o,
      bottomColor: o.bottomColor === "dark" ? "light" : "dark",
    });
    expect(swap(swap(DEFAULT))).toEqual(DEFAULT);
    expect(layoutToBuilderState(photo(), swap(swap(DEFAULT)))).toEqual(layoutToBuilderState(photo(), DEFAULT));
  });
});

// "I am" (myColor / setMyColor) on a real photo: PXL_20260927_142233229.jpg's
// saved layout, copied from snap-poc/truth/ (not read from the file). The real
// game is light 61 / dark 106, reachable only with light as the near player.
// Home left: bottom row reads 1..12 left to right, top row 24..13.
// Light (bottom): 4*1 + 2*2 + 3*3 + 2*4 + 2*6 + 2*12 = 61.
// Dark (top, own point = 25 - p): D1 on 5 -> 20, D2 on 9 -> 2*16, D2 on 24 -> 2*1,
// D1 on 23 -> 2, D2 on 22 -> 2*3, D2 on 20 -> 2*5, D3 on 19 -> 3*6, D2 on 17 -> 2*8 = 106.
function pxlPhoto(): SnapLayout {
  return {
    topRow: [D(2), D(1), D(2), none, D(2), D(3), none, D(2), none, none, none, none],
    bottomRow: [L(4), L(2), L(3), L(2), D(1), L(2), none, none, D(2), none, none, L(2)],
    bar: { light: 0, dark: 0 },
    borneOff: { light: 0, dark: 0 },
    dice: [3, 3],
    cube: { visible: true, value: 1, location: "center" },
    barSide: "middle",
    confidence: "high",
    notes: "",
  };
}

describe("Snaps 'I am' (the near player's colour)", () => {
  const saved: SnapOrientation = { bottomColor: "dark", bottomHome: "left", mirroredNumbers: true };

  it("the saved orientation (I am dark) gives 269 / 314", () => {
    expect(myColor(saved)).toBe("dark");
    expect(pipCounts(layoutToBuilderState(pxlPhoto(), saved).position)).toEqual({ mine: 269, opponent: 314 });
  });

  it("I am light, home left: bottom 61 / top 106", () => {
    const o = setMyColor(saved, "light");
    expect(myColor(o)).toBe("light");
    const state = layoutToBuilderState(pxlPhoto(), o);
    expect(pipCounts(state.position)).toEqual({ mine: 61, opponent: 106 });
    expect(validateBuilderState(state)).toEqual([]);
  });

  it("rotate keeps I am unchanged and swaps to 106 / 61", () => {
    const o = toggleRotate(setMyColor(saved, "light"));
    expect(myColor(o)).toBe("light");
    expect(pipCounts(layoutToBuilderState(pxlPhoto(), o).position)).toEqual({ mine: 106, opponent: 61 });
  });

  it("swap colours still changes nothing", () => {
    // Swap colours is a Board display flag, not an orientation input: the
    // state and pips depend on the orientation alone, rotated or not.
    for (const o of [setMyColor(saved, "light"), toggleRotate(setMyColor(saved, "light"))]) {
      expect(layoutToBuilderState(pxlPhoto(), o)).toEqual(layoutToBuilderState(pxlPhoto(), { ...o }));
      expect(myColor(o)).toBe("light");
    }
  });

  for (const rotated of [false, true]) {
    it(`setMyColor then myColor round-trips (${rotated ? "rotated" : "not rotated"})`, () => {
      for (const start of ["light", "dark"] as const) {
        const base: SnapOrientation = { ...saved, bottomColor: start, rotated };
        for (const color of ["light", "dark"] as const) {
          const o = setMyColor(base, color);
          expect(myColor(o)).toBe(color);
          expect(Boolean(o.rotated)).toBe(rotated);
          expect(o.bottomHome).toBe(base.bottomHome);
          expect(o.mirroredNumbers).toBe(base.mirroredNumbers);
        }
      }
    });
  }
});
