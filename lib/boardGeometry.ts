// Pure layout math for app/components/match-analysis/Board.tsx: where every
// point, stack, bar checker, off-tray slot and move-arrow endpoint sits in
// the board SVG's coordinate space. Board.tsx renders from these and the
// arrow anchoring (moveAnchor) reads the *same* functions, so an arrow can't
// drift from the checker it points at — the bug class behind the
// fixed-perspective arrow fix (PROGRESS.md, 2026-10-01), where moveAnchor
// carried its own hand-synced copy of the mine-side geometry.
import type { DecodedPosition } from "@/lib/gnuPositionId";

// Clubroom's board (design/mockups/replay.html's board(), viewBox
// 562 × 380; reports/2026-10-08-design-fidelity-spec.md §2.1). The frame
// band is MARGIN_Y above and below (the point numbers sit in it) and
// MARGIN_X on the right; the cube gutter is the left frame band.
export const MARGIN_Y = 20;
export const MARGIN_X = 14;
export const POINT_W = 36;
export const BAR_W = 30;
// The off column: an 8u frame gap, then the 34u tray.
export const OFF_W = 42;
export const OFF_TRAY_GAP = 8;
export const ROW_H = 170;
export const TRI_H = 148;
// Half a triangle's base: 1u less than half a point, so neighbours don't touch.
export const TRI_HALF_W = POINT_W / 2 - 1;
export const R = 15;
// The turned ring inside a checker.
export const RING_R = R - 5.5;
// 2u between neighbouring checkers: they don't overlap.
export const STACK_GAP = 32;
export const MAX_STACK = 5;
export const OFF_SLOTS = 15;

// Column order left-to-right for BOTH rows (bar-aligned): 6 points, bar, 6 points, off-tray.
export const COL_WIDTHS = [
  POINT_W, POINT_W, POINT_W, POINT_W, POINT_W, POINT_W,
  BAR_W,
  POINT_W, POINT_W, POINT_W, POINT_W, POINT_W, POINT_W,
  OFF_W,
];
export const BAR_COL = 6;
export const OFF_COL = 13;

// A slim gutter on the board's left edge for the doubling cube badge —
// mirrors the off-tray's role on the right. Kept as a shift of the whole
// existing grid's origin (not a prepended COL_WIDTHS entry) so BAR_COL/
// OFF_COL and every point<->column formula below are untouched.
export const CUBE_COL_W = 30;
const GRID_X0 = MARGIN_X + CUBE_COL_W;

export function colX(col: number): number {
  let x = GRID_X0;
  for (let i = 0; i < col; i++) x += COL_WIDTHS[i];
  return x;
}

export function colCenterX(col: number): number {
  return colX(col) + COL_WIDTHS[col] / 2;
}

export const BOARD_W = colX(COL_WIDTHS.length) + MARGIN_X;
export const Y0 = MARGIN_Y;
export const Y1 = MARGIN_Y + 2 * ROW_H;
export const BOARD_H = Y1 + MARGIN_Y;
// The board's horizontal dividing line.
export const CENTER_Y = Y0 + ROW_H;

// Point numbers: centred in the frame band above and below the field.
export const NUMBER_TOP_Y = MARGIN_Y / 2;
export const NUMBER_BOTTOM_Y = Y1 + MARGIN_Y / 2;

// Dice sit in the "right field" (points 1-6/19-24 — the columns between the
// bar and the off-tray), centred on the board's dividing line, as native
// SVG (Board.tsx's BoardDie): two DIE_SIZE squares DIE_GAP apart, in roll
// order.
export const DIE_SIZE = 26;
export const DIE_GAP = 8;
export const DICE_CENTER_X = (colX(BAR_COL + 1) + colX(OFF_COL)) / 2;
// Top-left corner of die `index` (0 or 1).
export function diePosition(index: number): { x: number; y: number } {
  const x = index === 0 ? DICE_CENTER_X - DIE_GAP / 2 - DIE_SIZE : DICE_CENTER_X + DIE_GAP / 2;
  return { x, y: CENTER_Y - DIE_SIZE / 2 };
}
// Pip centres as fractions of the die's side (the mockup's dieSVG); none
// for a value outside 1-6. An own-property lookup: values come from
// Galaxy's JSON unvalidated.
const DIE_PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]],
};
export function diePips(value: number): [number, number][] {
  return Object.hasOwn(DIE_PIPS, value) ? DIE_PIPS[value] : [];
}

// The two sides as drawn: "mine" (dark) always occupies the bottom half's
// bar and off-tray, "opponent" (light) the top half's. A flipped board
// doesn't move these — it swaps which player's data fills each side
// (flipPerspective, upstream in BoardPanel.tsx).
export type Side = "mine" | "opponent";

// The doubling cube's holder: either side, same framing as checkers, or
// "center" before any double has been taken this game.
export type CubeOwner = Side | "center";

export type PointRef = number | "bar" | "off";

// Bottom row = points 1-12 (right-to-left: 6..1 next to bar, 12..7 on the outside).
// Top row = points 13-24 (left-to-right: 13..18 on the outside, 19..24 next to bar).
export function pointColumn(point: number): number {
  if (point >= 1 && point <= 6) return 13 - point;
  if (point >= 7 && point <= 12) return 12 - point;
  if (point >= 13 && point <= 18) return point - 13;
  return point - 12;
}

export function pointRow(point: number): "bottom" | "top" {
  return point <= 12 ? "bottom" : "top";
}

export function trianglePoints(point: number): string {
  const col = pointColumn(point);
  const cx = colCenterX(col);
  const halfW = TRI_HALF_W;
  if (pointRow(point) === "bottom") {
    return `${cx - halfW},${Y1} ${cx + halfW},${Y1} ${cx},${Y1 - TRI_H}`;
  }
  return `${cx - halfW},${Y0} ${cx + halfW},${Y0} ${cx},${Y0 + TRI_H}`;
}

export interface StackBase {
  cx: number;
  baseY: number;
  dir: 1 | -1;
}

// Bottom-half stacks grow upward from the bottom edge, top-half stacks
// downward from the top edge, 2u in from it.
function halfStackBase(cx: number, half: "bottom" | "top"): StackBase {
  return half === "bottom"
    ? { cx, baseY: Y1 - R - 2, dir: -1 }
    : { cx, baseY: Y0 + R + 2, dir: 1 };
}

// Both sides share a point's stack origin — which half it's in depends
// only on the physical point, not whose checkers are on it.
export function stackBase(point: number): StackBase {
  return halfStackBase(colCenterX(pointColumn(point)), pointRow(point));
}

export function barStackBase(side: Side): StackBase {
  return halfStackBase(colCenterX(BAR_COL), side === "mine" ? "bottom" : "top");
}

// Center y of the checker at `index` in a stack, clamped to the drawn
// range: below 0 (an empty stack's "top") anchors at the base, and past
// MAX_STACK - 1 at the last drawn checker (the one carrying the "+N more"
// label).
export function stackSlotY({ baseY, dir }: StackBase, index: number): number {
  const visualIndex = Math.min(Math.max(index, 0), MAX_STACK - 1);
  return baseY + dir * visualIndex * STACK_GAP;
}

// The two off trays (34u wide, after the 8u frame gap), 8u apart across
// the centre line.
export const OFF_TRAY_X = colX(OFF_COL) + OFF_TRAY_GAP;
export const OFF_TRAY_W = OFF_W - OFF_TRAY_GAP;
export const OFF_TRAY_H = ROW_H - 4;
export function offTrayRect(side: Side): { x: number; y: number; width: number; height: number } {
  const y = side === "mine" ? CENTER_Y + 4 : Y0;
  return { x: OFF_TRAY_X, y, width: OFF_TRAY_W, height: OFF_TRAY_H };
}

// Off-tray checker track, inset 5u inside the tray.
export const OFF_TRACK_X = OFF_TRAY_X + 5;
export const OFF_TRACK_W = OFF_TRAY_W - 10;

// Each side's off-tray half, 4u inside its tray. The badge always sits at
// the end nearest the board's center line, so the two halves mirror each
// other across it.
export function offTrayBounds(side: Side): { topY: number; bottomY: number; badgeAtBottom: boolean } {
  const tray = offTrayRect(side);
  return { topY: tray.y + 4, bottomY: tray.y + tray.height - 4, badgeAtBottom: side === "opponent" };
}

// Badge always sits at the "near" end of the range (topY when badgeAtBottom
// is false, bottomY when true); checkers fill starting at the far end and
// grow toward the badge.
export function offColumnGeometry(topY: number, bottomY: number, badgeAtBottom: boolean) {
  const badgeR = 10;
  const badgeCy = badgeAtBottom ? bottomY - badgeR - 3 : topY + badgeR + 3;
  const trackTop = badgeAtBottom ? topY : badgeCy + badgeR + 5;
  const trackBottom = badgeAtBottom ? badgeCy - badgeR - 5 : bottomY;
  const slotSpan = (trackBottom - trackTop) / OFF_SLOTS;
  return { badgeR, badgeCy, trackTop, trackBottom, slotSpan };
}

// Whether off-tray slot `i` (0 = top) is drawn filled for `count` borne-off
// checkers — fills from the end farthest from the badge. Shared by the
// OffTray render (Board.tsx) and moveAnchor's "next empty slot".
export function isOffSlotFilled(i: number, count: number, badgeAtBottom: boolean): boolean {
  return badgeAtBottom ? i < count : i >= OFF_SLOTS - count;
}

// Index of the next empty off-tray slot for `count` borne-off checkers,
// clamped to the track.
export function nextOffSlotIndex(count: number, badgeAtBottom: boolean): number {
  const index = badgeAtBottom ? count : OFF_SLOTS - count - 1;
  return Math.min(Math.max(index, 0), OFF_SLOTS - 1);
}

// Stack-aware anchor for a move arrow endpoint: the exact visual position of
// the checker involved, not a generic per-point anchor. `isOrigin` picks the
// top-of-stack (checker about to move) vs. the next open slot (where it will
// land), both read from the *pre-move* `decoded` counts.
//
// `flipped` must match the flag Board itself renders with: when true,
// `decoded`/subMoves have already been through flipPerspective/
// mirrorSubMoves upstream, so the mover's own checkers live in
// decoded.opponent — and, for bar/off, in the opponent side's top-half
// geometry — not decoded.mine's bottom half.
export function moveAnchor(
  ref: PointRef,
  decoded: DecodedPosition,
  isOrigin: boolean,
  flipped: boolean
): { x: number; y: number } {
  const side: Side = flipped ? "opponent" : "mine";

  if (ref === "bar") {
    const base = barStackBase(side);
    const barCount = flipped ? decoded.opponentBar : decoded.mineBar;
    return { x: base.cx, y: stackSlotY(base, isOrigin ? barCount - 1 : barCount) };
  }

  if (ref === "off") {
    const { topY, bottomY, badgeAtBottom } = offTrayBounds(side);
    const offCount = flipped ? decoded.opponentOff : decoded.mineOff;
    const { trackTop, slotSpan } = offColumnGeometry(topY, bottomY, badgeAtBottom);
    const nextIndex = nextOffSlotIndex(offCount, badgeAtBottom);
    return {
      x: OFF_TRACK_X + OFF_TRACK_W / 2,
      y: trackTop + nextIndex * slotSpan + slotSpan / 2,
    };
  }

  const count = (flipped ? decoded.opponent : decoded.mine)[ref - 1];
  const base = stackBase(ref);
  return { x: base.cx, y: stackSlotY(base, isOrigin ? count - 1 : count) };
}

// Half the cube's side (a 26u rounded square) — deliberately not R (the
// checker radius), so it reads as a visually distinct shape, not another
// checker-sized circle.
export const CUBE_BADGE_R = 13;

// Center of the cube badge in the left gutter (see CUBE_COL_W): on the
// board's own dividing line when centered/undoubled, or inset into the
// owning side's half otherwise — mirrors how bar checkers sit close to
// (not at) the board's top/bottom edge.
export function cubeBadgeCenter(owner: CubeOwner): { x: number; y: number } {
  const x = MARGIN_X + CUBE_COL_W / 2;
  if (owner === "center") return { x, y: CENTER_Y };
  const y = owner === "mine" ? Y1 - CUBE_BADGE_R - 4 : Y0 + CUBE_BADGE_R + 4;
  return { x, y };
}

// Center of the OFFERED cube on a take/pass board: the value being offered
// (twice the current cube), centred horizontally on the playing field (the
// bar column — the field's centre, between the two 6-point halves) and
// against the receiver's edge, as Galaxy's own board draws a pending double
// (its cube painter centres the offered cube horizontally and puts it flush
// with the frame on the receiver's side). `side` is the receiver's side as
// drawn. Inset 2px from the field edge so the outline isn't clipped.
export function offeredCubeCenter(side: Side): { x: number; y: number } {
  const x = colCenterX(BAR_COL);
  const y = side === "mine" ? Y1 - CUBE_BADGE_R - 2 : Y0 + CUBE_BADGE_R + 2;
  return { x, y };
}
