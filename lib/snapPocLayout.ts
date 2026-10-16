// Snaps proof-of-concept: the board layout Gemini reads from a photo
// (scripts/snaps/snap-poc.ts), and a light validator for it. Purely visual: rows
// are left to right as seen in the photo, colours are "light"/"dark" as they
// look, with no backgammon perspective (whose home board, direction of play).
// Step 2 (the local review page, app/snap-poc) reuses these types and the
// layout <-> builder-state mapping at the bottom.

import {
  CUBE_VALUES,
  initialPositionBuilderState,
  normalizeRoll,
  type PositionBuilderState,
} from "./positionBuilder";

export type SnapColor = "light" | "dark" | "none";

export interface SnapPoint {
  color: SnapColor;
  count: number;
}

export interface SnapLayout {
  topRow: SnapPoint[]; // 12, left to right as seen
  bottomRow: SnapPoint[]; // 12, left to right as seen
  bar: { light: number; dark: number };
  borneOff: { light: number; dark: number };
  dice: number[]; // 0-2 values, 1-6
  cube: {
    visible: boolean;
    value: number;
    location: "center" | "top" | "bottom" | "unknown";
  };
  barSide: string; // normally "middle"; kept so oddities can be reported
  confidence: "high" | "medium" | "low";
  notes: string;
}

export type SnapValidation =
  | { ok: true; layout: SnapLayout }
  | { ok: false; errors: string[] };

const COLORS = new Set(["light", "dark", "none"]);
const CONFIDENCE = new Set(["high", "medium", "low"]);
const CUBE_LOCATIONS = new Set(["center", "top", "bottom", "unknown"]);

function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Light structural check: 12 entries per row, non-negative integer counts,
 * known enum values. Doesn't check 15-per-colour totals; that's for step 2's
 * scoring to judge, not a parse failure. */
export function validateSnapLayout(input: unknown): SnapValidation {
  const errors: string[] = [];
  if (!isObject(input)) return { ok: false, errors: ["layout is not an object"] };

  for (const rowName of ["topRow", "bottomRow"] as const) {
    const row = input[rowName];
    if (!Array.isArray(row)) {
      errors.push(`${rowName} is not an array`);
      continue;
    }
    if (row.length !== 12) errors.push(`${rowName} has ${row.length} entries, expected 12`);
    row.forEach((p: unknown, i) => {
      if (!isObject(p)) {
        errors.push(`${rowName}[${i}] is not an object`);
        return;
      }
      if (typeof p.color !== "string" || !COLORS.has(p.color)) {
        errors.push(`${rowName}[${i}].color is invalid`);
      }
      if (!isNonNegInt(p.count)) errors.push(`${rowName}[${i}].count is not a non-negative integer`);
    });
  }

  for (const key of ["bar", "borneOff"] as const) {
    const v = input[key];
    if (!isObject(v)) {
      errors.push(`${key} is not an object`);
      continue;
    }
    if (!isNonNegInt(v.light)) errors.push(`${key}.light is not a non-negative integer`);
    if (!isNonNegInt(v.dark)) errors.push(`${key}.dark is not a non-negative integer`);
  }

  const dice = input.dice;
  if (!Array.isArray(dice)) errors.push("dice is not an array");
  else {
    if (dice.length > 2) errors.push(`dice has ${dice.length} entries, expected 0-2`);
    dice.forEach((d: unknown, i) => {
      if (!isNonNegInt(d) || d < 1 || d > 6) errors.push(`dice[${i}] is not 1-6`);
    });
  }

  const cube = input.cube;
  if (!isObject(cube)) errors.push("cube is not an object");
  else {
    if (typeof cube.visible !== "boolean") errors.push("cube.visible is not a boolean");
    if (!isNonNegInt(cube.value)) errors.push("cube.value is not a non-negative integer");
    if (typeof cube.location !== "string" || !CUBE_LOCATIONS.has(cube.location)) {
      errors.push("cube.location is invalid");
    }
  }

  if (typeof input.barSide !== "string") errors.push("barSide is not a string");
  if (typeof input.confidence !== "string" || !CONFIDENCE.has(input.confidence)) {
    errors.push("confidence is invalid");
  }
  if (typeof input.notes !== "string") errors.push("notes is not a string");

  return errors.length > 0 ? { ok: false, errors } : { ok: true, layout: input as unknown as SnapLayout };
}

/** Total checkers of each colour the layout shows: points, bar and tray. */
export function snapCheckerTotals(layout: SnapLayout): { light: number; dark: number } {
  let light = layout.bar.light + layout.borneOff.light;
  let dark = layout.bar.dark + layout.borneOff.dark;
  for (const p of [...layout.topRow, ...layout.bottomRow]) {
    if (p.color === "light") light += p.count;
    else if (p.color === "dark") dark += p.count;
  }
  return { light, dark };
}

// ---------------------------------------------------------------------------
// Layout <-> position builder state (step 2's review page).

/** How the photo's visual layout maps onto the builder: which colour is
 * drawn along the bottom edge (the builder's "Bottom" side, `mine`), and on
 * which side of the photo the photo's bottom player's home board is.
 * `mirroredNumbers` only changes the drawing: the review page draws the board
 * mirrored (point 1 bottom-left, Board's `homeLeft`); it plays no part in the
 * layout mapping below. `rotated` is a view change only, as if the viewer
 * walked round the table: every checker stays on the same point for its own
 * colour, and only which colour is drawn at the bottom changes. toggleRotate
 * swaps `bottomColor`, so it always names the colour drawn at the bottom;
 * `bottomHome` keeps describing the photo as taken, and the mapping below
 * reads the layout turned 180 degrees (rotateLayout180) with the home side
 * swapped too (viewHome), and turns it back on the way out, so stored layouts
 * stay in the photo's own frame. Both flags are optional, and absent means
 * false, so truth files saved before they existed load unchanged.
 *
 * `bottomColor` is no longer a user control. Editing it changed who owns
 * which checkers, so it changed the game and the pip counts, when all the
 * user wanted was to see the photo's colours the way they read them. The
 * review page's "Swap colours" toggle does that now as a drawing-only swap
 * (Board's swapCheckerColors), outside this type. `bottomColor` stays as the
 * mapping's input: every saved truth uses "dark" (darker colour = near
 * player), and Rotate still flips it internally as a view change. */
export interface SnapOrientation {
  bottomColor: "light" | "dark";
  bottomHome: "right" | "left";
  mirroredNumbers?: boolean;
  rotated?: boolean;
}

export const DEFAULT_SNAP_ORIENTATION: SnapOrientation = { bottomColor: "dark", bottomHome: "right" };

function otherHome(home: SnapOrientation["bottomHome"]): SnapOrientation["bottomHome"] {
  return home === "right" ? "left" : "right";
}

/** "Mirror checkers": the checkers mirror left-right on screen and the point
 * numbers stay put. Only the layout mapping flips. */
export function toggleMirrorCheckers(o: SnapOrientation): SnapOrientation {
  return { ...o, bottomHome: otherHome(o.bottomHome) };
}

/** "Mirror numbers": the point numbers mirror and the checkers stay where
 * they are on screen. The board is drawn mirrored and the layout mapping
 * flips with it, so each photo column still lands on the same screen column. */
export function toggleMirrorNumbers(o: SnapOrientation): SnapOrientation {
  return { ...o, bottomHome: otherHome(o.bottomHome), mirroredNumbers: !o.mirroredNumbers };
}

/** "Rotate board": view the board from the other side of the table. The
 * game doesn't change: each colour keeps its points, bar, tray and pip count,
 * and a cube owned by a colour stays with that colour. The colour drawn at
 * the bottom swaps (so the builder's Bottom/Top swap); `bottomHome` and
 * `mirroredNumbers` are untouched, so the two mirror toggles read the same.
 * Its own inverse. */
export function toggleRotate(o: SnapOrientation): SnapOrientation {
  return { ...o, bottomColor: otherColor(o.bottomColor), rotated: !o.rotated };
}

/** The bottom player's home side in the view the builder maps: the photo's
 * own `bottomHome`, or the other side when rotated (turning the board 180
 * degrees moves the home boards to the other side of the view). */
function viewHome(o: SnapOrientation): SnapOrientation["bottomHome"] {
  return o.rotated ? otherHome(o.bottomHome) : o.bottomHome;
}

/** The layout as seen with the photo turned 180 degrees: each row becomes
 * the other row reversed, a cube at the top goes to the bottom and back.
 * Bar and borne-off counts are per colour and the dice are a pair, so they
 * don't change. Its own inverse. */
export function rotateLayout180(layout: SnapLayout): SnapLayout {
  const location =
    layout.cube.location === "top" ? "bottom" : layout.cube.location === "bottom" ? "top" : layout.cube.location;
  return {
    ...layout,
    topRow: [...layout.bottomRow].reverse(),
    bottomRow: [...layout.topRow].reverse(),
    cube: { ...layout.cube, location },
  };
}

/** Whether "Mirror checkers" reads as on: the bottom home board is on the
 * other side from where the drawn numbers put it. */
export function isCheckersMirrored(o: SnapOrientation): boolean {
  return (o.bottomHome === "left") !== Boolean(o.mirroredNumbers);
}

/** Point number (1-24, in `mine`'s frame, as DecodedPosition indexes both
 * sides) shown at visual index `i` (0 = leftmost) of a row. Follows Board's
 * own drawing (lib/boardGeometry.ts pointColumn): with home on the right the
 * bottom row reads 12..1 left to right and the top row 13..24; home on the
 * left mirrors both rows. */
function pointAt(row: "top" | "bottom", i: number, bottomHome: SnapOrientation["bottomHome"]): number {
  const col = bottomHome === "right" ? i : 11 - i;
  return row === "bottom" ? 12 - col : 13 + col;
}

function otherColor(color: "light" | "dark"): "light" | "dark" {
  return color === "light" ? "dark" : "light";
}

function clampCubeValue(value: number): number {
  let best: number = CUBE_VALUES[0];
  for (const v of CUBE_VALUES) if (Math.abs(v - value) < Math.abs(best - value)) best = v;
  return best;
}

/** Visual layout -> builder state. The bottom colour is `mine`. When
 * `rotated`, the layout is read turned 180 degrees with the home side swapped
 * (viewHome); with toggleRotate's swapped `bottomColor` that leaves each
 * colour on the same points, only drawn on the other side. Each side's
 * borne-off count is 15 minus what's on its points and bar, so the builder's
 * checker totals stay at 15 (its add/remove edits keep each side's total
 * constant). When the layout's points and bar already hold 15 or fewer, that
 * equals the tray count; when they hold more, it goes negative and the
 * builder reports an invalid count until checkers are removed. */
export function layoutToBuilderState(photoLayout: SnapLayout, orientation: SnapOrientation): PositionBuilderState {
  const layout = orientation.rotated ? rotateLayout180(photoLayout) : photoLayout;
  const state = initialPositionBuilderState();
  const mineColor = orientation.bottomColor;
  const oppColor = otherColor(mineColor);
  const home = viewHome(orientation);
  const mine = new Array(24).fill(0);
  const opponent = new Array(24).fill(0);

  for (const row of ["top", "bottom"] as const) {
    const points = row === "top" ? layout.topRow : layout.bottomRow;
    points.slice(0, 12).forEach((p, i) => {
      if (p.count <= 0 || p.color === "none") return;
      const point = pointAt(row, i, home);
      if (p.color === mineColor) mine[point - 1] = p.count;
      else opponent[point - 1] = p.count;
    });
  }

  const mineBar = layout.bar[mineColor];
  const opponentBar = layout.bar[oppColor];
  const onBoard = (side: number[], bar: number) => side.reduce((a, b) => a + b, bar);
  state.position = {
    mine,
    opponent,
    mineBar,
    opponentBar,
    mineOff: 15 - onBoard(mine, mineBar),
    opponentOff: 15 - onBoard(opponent, opponentBar),
  };

  state.roll = layout.dice.length === 2 ? normalizeRoll([layout.dice[0], layout.dice[1]]) : null;
  state.decisionType = state.roll ? "checker" : "cube";

  const owner =
    layout.cube.visible && layout.cube.location === "top"
      ? "opponent"
      : layout.cube.visible && layout.cube.location === "bottom"
        ? "mine"
        : "center";
  const value = clampCubeValue(layout.cube.value);
  // A cube at 1 is centred; an owned cube is at least 2 (the builder's rules).
  if (owner === "center" || value === 1) {
    state.cubeOwner = "center";
    state.cubeValue = 1;
  } else {
    state.cubeOwner = owner;
    state.cubeValue = value;
  }
  return state;
}

/** Builder state -> visual layout: the inverse of layoutToBuilderState, used
 * to store the user's corrected board as a layout comparable with Gemini's
 * (in the photo's own frame: a rotated reading is turned back). */
export function builderStateToLayout(state: PositionBuilderState, orientation: SnapOrientation): SnapLayout {
  const layout = viewLayout(state, orientation);
  return orientation.rotated ? rotateLayout180(layout) : layout;
}

function viewLayout(state: PositionBuilderState, orientation: SnapOrientation): SnapLayout {
  const mineColor = orientation.bottomColor;
  const oppColor = otherColor(mineColor);
  const { position } = state;
  const rowOf = (row: "top" | "bottom"): SnapPoint[] =>
    Array.from({ length: 12 }, (_, i) => {
      const point = pointAt(row, i, viewHome(orientation));
      const m = position.mine[point - 1];
      const o = position.opponent[point - 1];
      if (m > 0) return { color: mineColor, count: m };
      if (o > 0) return { color: oppColor, count: o };
      return { color: "none", count: 0 };
    });

  const byColor = (mineValue: number, oppValue: number) =>
    (mineColor === "light"
      ? { light: mineValue, dark: oppValue }
      : { light: oppValue, dark: mineValue });

  return {
    topRow: rowOf("top"),
    bottomRow: rowOf("bottom"),
    bar: byColor(position.mineBar, position.opponentBar),
    borneOff: byColor(Math.max(0, position.mineOff), Math.max(0, position.opponentOff)),
    dice: state.roll ? [...state.roll] : [],
    cube: {
      visible: true,
      value: state.cubeValue,
      location: state.cubeOwner === "mine" ? "bottom" : state.cubeOwner === "opponent" ? "top" : "center",
    },
    barSide: "middle",
    confidence: "high",
    notes: "",
  };
}
