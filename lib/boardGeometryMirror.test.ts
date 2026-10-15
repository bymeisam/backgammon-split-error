import { describe, expect, it } from "vitest";
import {
  BOARD_W,
  DIE_SIZE,
  OFF_TRAY_W,
  barStackBase,
  cubeBadgeCenter,
  diePosition,
  moveAnchor,
  offTrackCenterX,
  offTrackX,
  offTrayRect,
  offeredCubeCenter,
  stackBase,
  trianglePoints,
} from "./boardGeometry";
import type { DecodedPosition } from "./gnuPositionId";

// Board's homeLeft mode: the same board reflected across its vertical centre
// line, so point 1 sits bottom-left.

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
// Points of a row ordered by their label's x (labels sit at stackBase.cx).
const leftToRight = (points: number[], homeLeft: boolean) =>
  [...points].sort((a, b) => stackBase(a, homeLeft).cx - stackBase(b, homeLeft).cx);

function decoded(): DecodedPosition {
  const mine = new Array(24).fill(0);
  const opponent = new Array(24).fill(0);
  mine[5] = 3;
  opponent[18] = 2;
  return { mine, opponent, mineBar: 1, opponentBar: 0, mineOff: 2, opponentOff: 0 };
}

describe("mirrored board geometry (homeLeft)", () => {
  it("reflects every point's x across the board's centre line, keeping its y", () => {
    for (const point of range(1, 24)) {
      const plain = stackBase(point);
      const mirrored = stackBase(point, true);
      expect(mirrored.cx).toBe(BOARD_W - plain.cx);
      expect(mirrored.baseY).toBe(plain.baseY);
      expect(mirrored.dir).toBe(plain.dir);
    }
  });

  it("reads 1..12 left to right along the bottom and 24..13 along the top", () => {
    expect(leftToRight(range(1, 12), true)).toEqual(range(1, 12));
    expect(leftToRight(range(13, 24), true)).toEqual(range(13, 24).reverse());
    // The default board is untouched: 12..1 along the bottom, 13..24 along the top.
    expect(leftToRight(range(1, 12), false)).toEqual(range(1, 12).reverse());
    expect(leftToRight(range(13, 24), false)).toEqual(range(13, 24));
  });

  it("puts point 1 bottom-left, on the left of the bar", () => {
    expect(stackBase(1, true).cx).toBeLessThan(barStackBase("mine", true).cx);
    expect(stackBase(1, true).cx).toBeLessThan(stackBase(12, true).cx);
  });

  it("mirrors the triangles with their points", () => {
    expect(trianglePoints(1, true)).toBe(
      trianglePoints(1)
        .split(" ")
        .map((pair) => {
          const [x, y] = pair.split(",").map(Number);
          return `${BOARD_W - x},${y}`;
        })
        .join(" ")
        .replace(/^(\S+) (\S+)/, "$2 $1")
    );
  });

  it("keeps the bar in the middle of the field", () => {
    const bar = barStackBase("mine", true).cx;
    expect(bar).toBe(BOARD_W - barStackBase("mine").cx);
    expect(stackBase(6, true).cx).toBeLessThan(bar);
    expect(stackBase(7, true).cx).toBeGreaterThan(bar);
  });

  it("moves the off-tray to the left edge and the cube gutter to the right", () => {
    const plainTray = offTrayRect("mine");
    const tray = offTrayRect("mine", true);
    expect(tray.x).toBe(BOARD_W - plainTray.x - OFF_TRAY_W);
    expect(tray.y).toBe(plainTray.y);
    expect(tray.x + tray.width).toBeLessThan(stackBase(1, true).cx);
    expect(plainTray.x).toBeGreaterThan(stackBase(1).cx);
    expect(offTrackCenterX(true)).toBe(BOARD_W - offTrackCenterX());
    expect(offTrackX(true)).toBeGreaterThanOrEqual(tray.x);
    expect(cubeBadgeCenter("center", true).x).toBe(BOARD_W - cubeBadgeCenter("center").x);
    expect(cubeBadgeCenter("center", true).x).toBeGreaterThan(stackBase(12, true).cx);
    expect(offeredCubeCenter("mine", true).x).toBe(barStackBase("mine", true).cx);
  });

  it("moves the dice to the mirrored field, keeping roll order left to right", () => {
    const d0 = diePosition(0, true);
    const d1 = diePosition(1, true);
    expect(d0.x).toBeLessThan(d1.x);
    const centre = (d0.x + d1.x + DIE_SIZE) / 2;
    const plainCentre = (diePosition(0).x + diePosition(1).x + DIE_SIZE) / 2;
    expect(centre).toBe(BOARD_W - plainCentre);
    expect(centre).toBeLessThan(barStackBase("mine", true).cx);
  });

  it("mirrors move-arrow anchors, flipped or not", () => {
    for (const flipped of [false, true]) {
      for (const ref of [6, 19, "bar", "off"] as const) {
        for (const isOrigin of [true, false]) {
          const plain = moveAnchor(ref, decoded(), isOrigin, flipped);
          const mirrored = moveAnchor(ref, decoded(), isOrigin, flipped, true);
          expect(mirrored.x).toBe(BOARD_W - plain.x);
          expect(mirrored.y).toBe(plain.y);
        }
      }
    }
  });

  it("leaves the default board's numbers unchanged", () => {
    for (const point of range(1, 24)) {
      expect(stackBase(point, false)).toEqual(stackBase(point));
      expect(trianglePoints(point, false)).toBe(trianglePoints(point));
    }
    expect(offTrayRect("opponent", false)).toEqual(offTrayRect("opponent"));
    expect(diePosition(1, false)).toEqual(diePosition(1));
  });
});
