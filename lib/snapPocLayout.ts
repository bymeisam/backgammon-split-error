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

/** How the photo's layout maps onto the builder, in /snap-poc's two steps.
 *
 * Step 1, "Make the board match the photo", sets the view: `rotated` (read
 * the layout turned 180 degrees, as if the viewer walked round the table)
 * and `layoutMirrored` (read the layout mirrored left to right, for a
 * reading that came out back to front). The builder draws the layout after
 * those two transforms (orientedLayout) as it is: each photo column on the
 * same screen column (Board's `homeLeft` follows the home side, boardHomeLeft)
 * and each photo colour in its own colour (boardSwapColors). Rotate never
 * changes the game; Mirror changes it (the checkers move relative to the
 * home boards). "Swap colours" is a drawing-only flip, outside this type.
 *
 * Step 2, "Make the game right", sets the game on the board as drawn:
 * `analyzingFor` (the player to move) and which drawn corner is that
 * colour's home board (homeCorner / setHomeCorner). Stored as
 * - `bottomColor`: the colour drawn along the bottom (the builder's `mine`);
 *   toggleRotate swaps it, so it always names the colour drawn at the bottom;
 * - `bottomHome`: the side of the bottom colour's home board in the layout
 *   unrotated (after the mirror); viewHome gives the side as drawn;
 * - `analyzingFor`: absent means `bottomColor` (the bottom player to move).
 *
 * Every flag is optional and absent means off, so truth files saved before
 * they existed load as the game they always gave. `mirroredNumbers` is a
 * retired drawing-only flag: still accepted in old files, ignored. Stored
 * layouts stay in the photo's own frame: builderStateToLayout undoes the
 * step 1 transforms, so scoring (lib/snapPocScore.ts) never sees them. */
export interface SnapOrientation {
  bottomColor: "light" | "dark";
  bottomHome: "right" | "left";
  /** Retired (old truth files only); ignored. */
  mirroredNumbers?: boolean;
  rotated?: boolean;
  layoutMirrored?: boolean;
  analyzingFor?: "light" | "dark";
}

export const DEFAULT_SNAP_ORIENTATION: SnapOrientation = { bottomColor: "dark", bottomHome: "right" };

/** A corner of the board as drawn, in reading order: 1 top-left, 2 top-right,
 * 3 bottom-left, 4 bottom-right. */
export type SnapCorner = 1 | 2 | 3 | 4;
export const SNAP_CORNERS: readonly SnapCorner[] = [1, 2, 3, 4];

export function cornerRow(corner: SnapCorner): "top" | "bottom" {
  return corner <= 2 ? "top" : "bottom";
}

export function cornerSide(corner: SnapCorner): "left" | "right" {
  return corner % 2 === 1 ? "left" : "right";
}

function cornerAt(row: "top" | "bottom", side: "left" | "right"): SnapCorner {
  return ((row === "top" ? 1 : 3) + (side === "left" ? 0 : 1)) as SnapCorner;
}

/** "Bottom-right" and so on. */
export function cornerName(corner: SnapCorner): string {
  const row = cornerRow(corner);
  return `${row === "top" ? "Top" : "Bottom"}-${cornerSide(corner)}`;
}

function otherHome(home: SnapOrientation["bottomHome"]): SnapOrientation["bottomHome"] {
  return home === "right" ? "left" : "right";
}

/** Step 1 "Mirror checkers": read the layout mirrored left to right, for a
 * reading that came out back to front. The drawing mirrors, the drawn home
 * corner stays, so the game changes (by design). Its own inverse. */
export function toggleMirrorCheckers(o: SnapOrientation): SnapOrientation {
  return { ...o, layoutMirrored: !o.layoutMirrored };
}

/** Step 1 "Rotate board": view the board from the other side of the table.
 * The game doesn't change: each colour keeps its points, bar, tray and pip
 * count, and a cube owned by a colour stays with that colour. The colour
 * drawn at the bottom swaps and the drawn home corner turns with the board
 * (1<->4, 2<->3). Its own inverse. */
export function toggleRotate(o: SnapOrientation): SnapOrientation {
  return { ...o, bottomColor: otherColor(o.bottomColor), rotated: !o.rotated };
}

/** The colour step 2 analyses for (the player to move). */
export function analyzingFor(o: SnapOrientation): "light" | "dark" {
  return o.analyzingFor ?? o.bottomColor;
}

/** Step 2 "Analyzing for": keeps the game (who owns which checkers), so the
 * home corner moves to the other colour's home (other row, same side). */
export function setAnalyzingFor(o: SnapOrientation, color: "light" | "dark"): SnapOrientation {
  return { ...o, analyzingFor: color };
}

/** The bottom player's home side as drawn: `bottomHome`, or the other side
 * when rotated (turning the board 180 degrees moves the home boards to the
 * other side of the view). */
export function viewHome(o: SnapOrientation): SnapOrientation["bottomHome"] {
  return o.rotated ? otherHome(o.bottomHome) : o.bottomHome;
}

/** The drawn corner of `color`'s home board (default: the analysed colour).
 * The bottom colour's home is on the bottom row, the other's on the top row,
 * both on the drawn home side. */
export function homeCorner(o: SnapOrientation, color: "light" | "dark" = analyzingFor(o)): SnapCorner {
  return cornerAt(color === o.bottomColor ? "bottom" : "top", viewHome(o));
}

/** Step 2 "Home board": the analysed colour's home is drawn corner `corner`.
 * Keeps the step 1 view (rotated, layoutMirrored) and the analysed colour. */
export function setHomeCorner(o: SnapOrientation, corner: SnapCorner): SnapOrientation {
  const color = analyzingFor(o);
  const side = cornerSide(corner);
  return {
    ...o,
    analyzingFor: color,
    bottomColor: cornerRow(corner) === "bottom" ? color : otherColor(color),
    bottomHome: o.rotated ? otherHome(side) : side,
  };
}

/** The builder's player to move: the analysed colour's side. */
export function playerToMove(o: SnapOrientation): "mine" | "opponent" {
  return analyzingFor(o) === o.bottomColor ? "mine" : "opponent";
}

/** Board's `homeLeft`: point 1 drawn on the left when the bottom home board
 * is drawn on the left. With it, each column of the oriented layout lands on
 * the same screen column (pointAt follows Board's drawing). */
export function boardHomeLeft(o: SnapOrientation): boolean {
  return viewHome(o) === "left";
}

/** The builder's `numbersFrom` in step 2: point numbering starts from the
 * analysed colour's home board (point 1 at the outer edge of its corner), so
 * it counts from the top player's side when the analysed colour is drawn at
 * the top. Only the printed numbers change, never the position. */
export function boardNumbersFrom(o: SnapOrientation): "mine" | "opponent" {
  return playerToMove(o);
}

/** Board's `swapCheckerColors`: Board draws `mine` dark, so a light bottom
 * colour is swapped to draw the photo's colours; "Swap colours" flips that. */
export function boardSwapColors(o: SnapOrientation, swapColors: boolean): boolean {
  return (o.bottomColor === "light") !== swapColors;
}

/** The layout mirrored left to right: each row reversed. Bar, trays, dice
 * and a cube's top/bottom don't change. Its own inverse. */
export function mirrorLayout(layout: SnapLayout): SnapLayout {
  return { ...layout, topRow: [...layout.topRow].reverse(), bottomRow: [...layout.bottomRow].reverse() };
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

/** The layout after step 1's transforms: what the builder draws. The two
 * transforms commute and are each their own inverse, so this is its own
 * inverse too (builderStateToLayout uses that). */
export function orientedLayout(layout: SnapLayout, o: SnapOrientation): SnapLayout {
  const mirrored = o.layoutMirrored ? mirrorLayout(layout) : layout;
  return o.rotated ? rotateLayout180(mirrored) : mirrored;
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

export function otherColor(color: "light" | "dark"): "light" | "dark" {
  return color === "light" ? "dark" : "light";
}

function clampCubeValue(value: number): number {
  let best: number = CUBE_VALUES[0];
  for (const v of CUBE_VALUES) if (Math.abs(v - value) < Math.abs(best - value)) best = v;
  return best;
}

/** Visual layout -> builder state. The layout is read after step 1's
 * transforms (orientedLayout), with the bottom colour as `mine`, its home on
 * the drawn home side (viewHome), and the analysed colour to move. When
 * `rotated`, toggleRotate's swapped `bottomColor` and the swapped home side
 * leave each colour on the same points, only drawn on the other side. Each side's
 * borne-off count is 15 minus what's on its points and bar, so the builder's
 * checker totals stay at 15 (its add/remove edits keep each side's total
 * constant). When the layout's points and bar already hold 15 or fewer, that
 * equals the tray count; when they hold more, it goes negative and the
 * builder reports an invalid count until checkers are removed. */
export function layoutToBuilderState(photoLayout: SnapLayout, orientation: SnapOrientation): PositionBuilderState {
  const layout = orientedLayout(photoLayout, orientation);
  const state = initialPositionBuilderState();
  state.playerToMove = playerToMove(orientation);
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
 * (in the photo's own frame: step 1's rotate and mirror are undone). */
export function builderStateToLayout(state: PositionBuilderState, orientation: SnapOrientation): SnapLayout {
  return orientedLayout(drawnLayout(state, orientation), orientation);
}

/** The builder's board as drawn, as a layout (step 1's transforms applied). */
function drawnLayout(state: PositionBuilderState, orientation: SnapOrientation): SnapLayout {
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
