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
// - Mirror checkers (step 1) reads the layout mirrored left to right, so it
//   changes the position: the same position as the home board on the other
//   side.
// The second half pins the two-step mapping (step 1 view, step 2 colour and
// drawn home corner) with a table, checked against Board's own geometry.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SNAP_ORIENTATION,
  SNAP_CORNERS,
  analyzingFor,
  boardHomeLeft,
  boardSwapColors,
  builderStateToLayout,
  homeCorner,
  layoutToBuilderState,
  playerToMove,
  setAnalyzingFor,
  setHomeCorner,
  toggleMirrorCheckers,
  toggleRotate,
  type SnapCorner,
  type SnapLayout,
  type SnapOrientation,
  type SnapPoint,
} from "./snapPocLayout";
import { validateBuilderState } from "./positionBuilder";
import { pipCounts } from "./pipCount";
import { CHECKER_PALETTE, checkerColors, paletteSide } from "./checkerPalette";
import { BAR_COL, drawnPoint, pointColumn, pointRow } from "./boardGeometry";

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

describe("Snaps orientation -> builder position and pip counts", () => {
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
      // The layout is read mirrored: bottom row (as drawn) reads 12..1 over
      // the photo's columns right to left, i.e. photo column i is point i + 1
      // (bottom) or 24 - i (top). Dark's 6-point stack (photo bottom index 6)
      // is now on point 7, its 8 on 5, its 4 on 9, its 13 on 24 and its 24
      // on 13; light's 1 -> 12, 12 -> 1, 17 -> 20, 19 -> 18, 20 -> 17.
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
      // The mirror-checkers game with Bottom/Top swapped. Light's own points
      // there (25 - p): 24, 13, 8, 7, 5; dark's own 24, 13, 9, 7, 5 show in
      // light's frame as 1, 12, 16, 18, 20.
      // Light: 3*24 + 2*13 + 2*8 + 5*7 + 2*5 = 159.
      // Dark (as in mirror checkers): 4*24 + 13 + 2*9 + 4*7 + 3*5 + 25 = 195.
      name: "mirror checkers + rotate: bottom 159 / top 195",
      orientation: toggleRotate(toggleMirrorCheckers(DEFAULT)),
      mine: { 24: 3, 13: 2, 8: 2, 7: 5, 5: 2 },
      opponent: { 1: 4, 12: 1, 16: 2, 18: 4, 20: 3 },
      mineBar: 0,
      opponentBar: 1,
      mineOff: 1,
      opponentOff: 0,
      pips: { mine: 159, opponent: 195 },
    },
  ];

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

  const toggles = { "mirror checkers": toggleMirrorCheckers, rotate: toggleRotate };
  for (const [name, toggle] of Object.entries(toggles)) {
    it(`${name} twice gives back the original (orientation and position)`, () => {
      const twice = toggle(toggle(DEFAULT));
      // Optional flags come back as `false` rather than absent; both mean off.
      expect({ ...twice, layoutMirrored: Boolean(twice.layoutMirrored), rotated: Boolean(twice.rotated) }).toEqual({
        ...DEFAULT,
        layoutMirrored: false,
        rotated: false,
      });
      expect(layoutToBuilderState(photo(), twice)).toEqual(layoutToBuilderState(photo(), DEFAULT));
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
    // Mirror checkers leaves the cube where it is.
    expect(layoutToBuilderState(owned("top"), toggleMirrorCheckers(DEFAULT)).cubeOwner).toBe("opponent");
  });

  it("builderStateToLayout gives back the photo layout for every step 1 view", () => {
    // Stored layouts stay in the photo's own frame, whatever the view.
    for (const o of views()) {
      const back = builderStateToLayout(layoutToBuilderState(photo(), o), o);
      expect(back.topRow).toEqual(photo().topRow);
      expect(back.bottomRow).toEqual(photo().bottomRow);
      expect(back.bar).toEqual(photo().bar);
      expect(back.borneOff).toEqual(photo().borneOff);
    }
  });
});

// ---------------------------------------------------------------------------
// The two steps: step 1's view (Mirror checkers, Rotate), then step 2's
// colour and drawn home corner.

/** Every step 1 view of DEFAULT: [mirrored, rotated]. */
function views(): SnapOrientation[] {
  return [false, true].flatMap((mirrored) =>
    [false, true].map((rotated) => {
      let o = DEFAULT;
      if (mirrored) o = toggleMirrorCheckers(o);
      if (rotated) o = toggleRotate(o);
      return o;
    })
  );
}

/** The photo layout after step 1, worked out here independently of
 * orientedLayout: mirrored reverses each row; rotated swaps the rows and
 * reverses each. */
function expectedView(layout: SnapLayout, mirrored: boolean, rotated: boolean): { top: SnapPoint[]; bottom: SnapPoint[] } {
  let top = [...layout.topRow];
  let bottom = [...layout.bottomRow];
  if (mirrored) [top, bottom] = [[...top].reverse(), [...bottom].reverse()];
  if (rotated) [top, bottom] = [[...bottom].reverse(), [...top].reverse()];
  return { top, bottom };
}

/** Where Board draws logical point `point` (in `mine`'s frame), from
 * lib/boardGeometry.ts: the row, the screen index 0-11 left to right
 * (skipping the bar column) and the half. */
function drawnAt(point: number, homeLeft: boolean): { row: "top" | "bottom"; index: number; half: "left" | "right" } {
  const column = drawnPoint(point, homeLeft); // the default board's point at that column
  const col = pointColumn(column);
  return {
    row: pointRow(column),
    index: col < BAR_COL ? col : col - 1,
    half: col < BAR_COL ? "left" : "right",
  };
}

function cornerOf(row: "top" | "bottom", half: "left" | "right"): SnapCorner {
  return ((row === "top" ? 1 : 3) + (half === "left" ? 0 : 1)) as SnapCorner;
}

/** Each colour's pip count for an orientation (pipCounts' `mine` is the
 * bottom colour). */
function colourPips(layout: SnapLayout, o: SnapOrientation): { light: number; dark: number } {
  const pips = pipCounts(layoutToBuilderState(layout, o).position);
  return o.bottomColor === "dark"
    ? { dark: pips.mine, light: pips.opponent }
    : { light: pips.mine, dark: pips.opponent };
}

const other = (c: "light" | "dark"): "light" | "dark" => (c === "light" ? "dark" : "light");
const ROTATED_CORNER: Record<SnapCorner, SnapCorner> = { 1: 4, 2: 3, 3: 2, 4: 1 };
const OTHER_HOME: Record<SnapCorner, SnapCorner> = { 1: 3, 2: 4, 3: 1, 4: 2 };

describe("Snaps two steps: the mapping table (Analyzing for Dark)", () => {
  // R = Rotate (step 1), K = the drawn corner picked in step 2. With
  // Mirror checkers off; Light swaps the colours in bottomColor. The last
  // column is where Dark's home is in the photo as taken.
  const table: [boolean, SnapCorner, SnapOrientation["bottomColor"], SnapOrientation["bottomHome"], "mine" | "opponent", string][] = [
    [false, 1, "light", "left", "opponent", "top-left"],
    [false, 2, "light", "right", "opponent", "top-right"],
    [false, 3, "dark", "left", "mine", "bottom-left"],
    [false, 4, "dark", "right", "mine", "bottom-right"],
    [true, 1, "light", "right", "opponent", "bottom-right"],
    [true, 2, "light", "left", "opponent", "bottom-left"],
    [true, 3, "dark", "right", "mine", "top-right"],
    [true, 4, "dark", "left", "mine", "top-left"],
  ];
  for (const [rotated, corner, bottomColor, bottomHome, mover, photoHome] of table) {
    it(`Rotate ${rotated ? "on" : "off"}, corner ${corner}: ${bottomColor} bottom, home ${bottomHome}, ${mover} to move (Dark's home photo ${photoHome})`, () => {
      const base = rotated ? toggleRotate(DEFAULT) : DEFAULT;
      for (const color of ["dark", "light"] as const) {
        const o = setHomeCorner(setAnalyzingFor(base, color), corner);
        expect(o.bottomColor).toBe(color === "dark" ? bottomColor : other(bottomColor));
        expect(o.bottomHome).toBe(bottomHome);
        expect(Boolean(o.rotated)).toBe(rotated);
        expect(playerToMove(o)).toBe(mover);
      }
      // Dark's home in the photo as taken: the drawn corner, turned back
      // when rotated.
      const photoCorner = rotated ? ROTATED_CORNER[corner] : corner;
      expect(["top-left", "top-right", "bottom-left", "bottom-right"][photoCorner - 1]).toBe(photoHome);
    });
  }
});

describe("Snaps two steps: every view x colour x corner", () => {
  for (const view of views()) {
    const mirrored = Boolean(view.layoutMirrored);
    const rotated = Boolean(view.rotated);
    for (const color of ["dark", "light"] as const) {
      for (const corner of SNAP_CORNERS) {
        const label = `${mirrored ? "mirrored" : "plain"}, ${rotated ? "rotated" : "unrotated"}, ${color}, corner ${corner}`;
        const o = setHomeCorner(setAnalyzingFor(view, color), corner);

        it(`${label}: keeps the view and reads the choice back`, () => {
          expect(analyzingFor(o)).toBe(color);
          expect(homeCorner(o)).toBe(corner);
          expect(homeCorner(o, other(color))).toBe(OTHER_HOME[corner]);
          expect(Boolean(o.rotated)).toBe(rotated);
          expect(Boolean(o.layoutMirrored)).toBe(mirrored);
        });

        it(`${label}: the board draws the step 1 view, in the photo's colours`, () => {
          const state = layoutToBuilderState(photo(), o);
          const homeLeft = boardHomeLeft(o);
          const view = expectedView(photo(), mirrored, rotated);
          const drawn = { top: new Array<SnapPoint>(12), bottom: new Array<SnapPoint>(12) };
          for (let point = 1; point <= 24; point++) {
            const at = drawnAt(point, homeLeft);
            const m = state.position.mine[point - 1];
            const p = state.position.opponent[point - 1];
            drawn[at.row][at.index] =
              m > 0 ? { color: o.bottomColor, count: m } : p > 0 ? { color: other(o.bottomColor), count: p } : { color: "none", count: 0 };
          }
          expect(drawn).toEqual(view);
          // Board draws `mine` in the mine palette; the photo's dark checkers
          // are drawn dark unless Swap colours is on.
          const darkSide = o.bottomColor === "dark" ? "mine" : "opponent";
          expect(paletteSide(darkSide, boardSwapColors(o, false))).toBe("mine");
          expect(paletteSide(darkSide, boardSwapColors(o, true))).toBe("opponent");
        });

        it(`${label}: the chosen colour's home board is drawn in the chosen corner`, () => {
          const state = layoutToBuilderState(photo(), o);
          const homeLeft = boardHomeLeft(o);
          const isMine = color === o.bottomColor;
          expect(state.playerToMove).toBe(isMine ? "mine" : "opponent");
          // Its own points 1-6: `mine`'s 1-6, or the opponent's 25 - p.
          const homePoints = [1, 2, 3, 4, 5, 6].map((p) => (isMine ? p : 25 - p));
          for (const point of homePoints) {
            const at = drawnAt(point, homeLeft);
            expect(cornerOf(at.row, at.half)).toBe(corner);
          }
          // Its ace point is the outermost point in that corner.
          const ace = drawnAt(isMine ? 1 : 24, homeLeft);
          expect(ace.index).toBe(cornerSide(corner) === "left" ? 0 : 11);
        });

        it(`${label}: Rotate and Swap colours never change the pips; Analyzing for keeps the game`, () => {
          const pips = colourPips(photo(), o);
          const turned = toggleRotate(o);
          expect(colourPips(photo(), turned)).toEqual(pips);
          expect(homeCorner(turned)).toBe(ROTATED_CORNER[corner]);
          expect(analyzingFor(turned)).toBe(color);
          // Swap colours is not an input to the mapping: only Board's flag.
          expect(boardSwapColors(o, true)).toBe(!boardSwapColors(o, false));
          const switched = setAnalyzingFor(o, other(color));
          expect(colourPips(photo(), switched)).toEqual(pips);
          expect(homeCorner(switched)).toBe(OTHER_HOME[corner]);
          // Mirror checkers keeps the drawn corner and changes the game.
          const mirroredAgain = toggleMirrorCheckers(o);
          expect(homeCorner(mirroredAgain)).toBe(corner);
          expect(colourPips(photo(), mirroredAgain)).not.toEqual(pips);
        });
      }
    }
  }
});

function cornerSide(corner: SnapCorner): "left" | "right" {
  return corner % 2 === 1 ? "left" : "right";
}

// PXL_20260927_142233229.jpg's saved layout, copied from snap-poc/truth/ (not
// read from the file). The real game is light 61 / dark 106: Light's home is
// photo bottom-left (dark's top-left).
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

describe("Snaps two steps on the PXL photo", () => {
  it("no step 1 transforms, Analyzing for Light, corner 3 (bottom-left): Light 61 / Dark 106", () => {
    const o = setHomeCorner(setAnalyzingFor(DEFAULT, "light"), 3);
    expect(o).toEqual({ bottomColor: "light", bottomHome: "left", analyzingFor: "light" });
    const state = layoutToBuilderState(pxlPhoto(), o);
    expect(pipCounts(state.position)).toEqual({ mine: 61, opponent: 106 });
    expect(colourPips(pxlPhoto(), o)).toEqual({ light: 61, dark: 106 });
    expect(state.playerToMove).toBe("mine");
    expect(validateBuilderState(state)).toEqual([]);
  });

  it("Analyzing for Dark, corner 1 (top-left) gives the same game, Dark to move", () => {
    const light = setHomeCorner(setAnalyzingFor(DEFAULT, "light"), 3);
    const dark = setHomeCorner(setAnalyzingFor(DEFAULT, "dark"), 1);
    expect(colourPips(pxlPhoto(), dark)).toEqual({ light: 61, dark: 106 });
    const a = layoutToBuilderState(pxlPhoto(), light);
    const b = layoutToBuilderState(pxlPhoto(), dark);
    expect(b.position).toEqual(a.position);
    expect(b.playerToMove).toBe("opponent");
    // Switching Analyzing for from Light 3 lands on Dark 1, and back.
    expect(homeCorner(setAnalyzingFor(light, "dark"))).toBe(1);
    expect(homeCorner(setAnalyzingFor(dark, "light"))).toBe(3);
  });

  it("Rotate keeps the game: Light 61 / Dark 106, corner 3 becomes 2", () => {
    const o = toggleRotate(setHomeCorner(setAnalyzingFor(DEFAULT, "light"), 3));
    expect(colourPips(pxlPhoto(), o)).toEqual({ light: 61, dark: 106 });
    expect(homeCorner(o)).toBe(2);
  });
});

describe("Snaps old truth files load as the same game", () => {
  // Saved before the two steps: no analyzingFor or layoutMirrored. Absent
  // fields keep their old meaning (bottom colour to move, layout as read),
  // and the retired mirroredNumbers flag is ignored.
  it("the PXL file's saved orientation still gives 269 / 314, bottom to move", () => {
    const saved: SnapOrientation = { bottomColor: "dark", bottomHome: "left", mirroredNumbers: true };
    const state = layoutToBuilderState(pxlPhoto(), saved);
    expect(pipCounts(state.position)).toEqual({ mine: 269, opponent: 314 });
    expect(state.playerToMove).toBe("mine");
    expect(analyzingFor(saved)).toBe("dark");
    expect(homeCorner(saved)).toBe(3);
    expect(layoutToBuilderState(pxlPhoto(), { ...saved, mirroredNumbers: false })).toEqual(state);
  });

  it("a rotated old file gives the same game as unrotated", () => {
    const saved: SnapOrientation = { bottomColor: "light", bottomHome: "right", rotated: true };
    expect(colourPips(pxlPhoto(), saved)).toEqual(colourPips(pxlPhoto(), toggleRotate(saved)));
  });

  it("swap colours stays drawing only", () => {
    expect(checkerColors("mine", false)).toEqual(CHECKER_PALETTE.mine);
    expect(checkerColors("mine", true)).toEqual(CHECKER_PALETTE.opponent);
    expect(checkerColors("opponent", true)).toEqual(CHECKER_PALETTE.mine);
  });
});
