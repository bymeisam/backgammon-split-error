// What each Snaps orientation option does to the builder position, checked
// on one fixed, asymmetric mid-game photo layout with both sides' pip
// counts. The expected positions are worked out by hand from the doc
// comments in lib/snapPocLayout.ts:
// - pointAt: home right -> bottom row reads 12..1 left to right, top row
//   13..24; home left mirrors both rows (bottom 1..12, top 24..13).
// - rotateLayout180: each row becomes the other row reversed.
// - Mirror numbers changes bottomHome (and the drawing), so it changes the
//   position, exactly as Mirror checkers does.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SNAP_ORIENTATION,
  layoutToBuilderState,
  toggleMirrorCheckers,
  toggleMirrorNumbers,
  toggleRotate,
  type SnapLayout,
  type SnapOrientation,
  type SnapPoint,
} from "./snapPocLayout";
import { validateBuilderState } from "./positionBuilder";
import { pipCounts } from "./pipCount";

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
    // The photo turned 180 degrees: each row becomes the other row reversed,
    // so photo bottom index i lands on top index 11 - i. With home still on
    // the right, every stack moves 12 points: p -> p + 12 (1-12) or p - 12
    // (13-24). Dark's 8 -> 20, 6 -> 18, 4 -> 16, 13 -> 1, 24 -> 12; light's
    // 1 -> 13, 12 -> 24, 17 -> 5, 19 -> 7, 20 -> 8.
    // Dark: 12 + 4*1 + 3*20 + 4*18 + 2*16 + 25 = 205.
    // Light: 2*12 + 3*1 + 2*20 + 5*18 + 2*17 = 191.
    name: "rotate: bottom 205 / top 191",
    orientation: toggleRotate(DEFAULT),
    mine: { 1: 4, 12: 1, 16: 2, 18: 4, 20: 3 },
    opponent: { 5: 2, 7: 5, 8: 2, 13: 2, 24: 3 },
    mineBar: 1,
    opponentBar: 0,
    mineOff: 0,
    opponentOff: 1,
    pips: { mine: 205, opponent: 191 },
  },
  {
    // Rotate (p -> p +/- 12) then home on the left (p -> 13 - p / 37 - p):
    // together p -> 25 - p, i.e. both sides now run the other way round the
    // board. Dark's 24 -> 1, 13 -> 12, 8 -> 17, 6 -> 19, 4 -> 21; light's
    // 1 -> 24, 12 -> 13, 17 -> 8, 19 -> 6, 20 -> 5.
    // Dark: 1 + 4*12 + 3*17 + 4*19 + 2*21 + 25 = 243.
    // Light: 2*1 + 3*12 + 2*17 + 5*19 + 2*20 = 207.
    name: "mirror numbers + rotate: bottom 243 / top 207",
    orientation: toggleRotate(toggleMirrorNumbers(DEFAULT)),
    mine: { 1: 1, 12: 4, 17: 3, 19: 4, 21: 2 },
    opponent: { 5: 2, 6: 5, 8: 2, 13: 3, 24: 2 },
    mineBar: 1,
    opponentBar: 0,
    mineOff: 0,
    opponentOff: 1,
    pips: { mine: 243, opponent: 207 },
  },
  {
    // Light is now the bottom side (`mine`), home still on the right, so the
    // point numbers stay put and the sides swap roles: light keeps the
    // point numbers it sat on in the photo but now moves towards point 1
    // (its 5 on point 19 were 6 pips each, now 19), and dark, now the top
    // side, keeps its point numbers but counts them as 25 - p.
    // Light: 3*12 + 2*1 + 2*17 + 5*19 + 2*20 = 207 (1 borne off).
    // Dark: 3*17 + 4*19 + 2*21 + 4*12 + 1*1 + 25 = 243.
    name: "bottom colour swapped (light bottom): bottom 207 / top 243",
    orientation: { ...DEFAULT, bottomColor: "light" },
    mine: { 1: 2, 12: 3, 17: 2, 19: 5, 20: 2 },
    opponent: { 4: 2, 6: 4, 8: 3, 13: 4, 24: 1 },
    mineBar: 0,
    opponentBar: 1,
    mineOff: 1,
    opponentOff: 0,
    pips: { mine: 207, opponent: 243 },
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

  it("bottom colour swapped twice gives back the original", () => {
    const swap = (o: SnapOrientation): SnapOrientation => ({
      ...o,
      bottomColor: o.bottomColor === "dark" ? "light" : "dark",
    });
    expect(swap(swap(DEFAULT))).toEqual(DEFAULT);
    expect(layoutToBuilderState(photo(), swap(swap(DEFAULT)))).toEqual(layoutToBuilderState(photo(), DEFAULT));
  });
});
