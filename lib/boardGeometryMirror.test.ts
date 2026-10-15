import { describe, expect, it } from "vitest";
import type { DecodedPosition } from "./gnuPositionId";
import { drawnPoint, moveAnchor, stackBase, trianglePoints } from "./boardGeometry";

// Board's homeLeft mode: only the point numbering is mirrored (point 1
// bottom-left). The board is drawn column by column exactly as by default;
// drawnPoint maps a logical point to the default point whose column it takes.

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
// Points of a row ordered by their x (labels and stacks sit at stackBase.cx).
const leftToRight = (points: number[], homeLeft: boolean) =>
  [...points].sort((a, b) => stackBase(a, homeLeft).cx - stackBase(b, homeLeft).cx);

function decoded(): DecodedPosition {
  const mine = new Array(24).fill(0);
  const opponent = new Array(24).fill(0);
  mine[5] = 3;
  opponent[18] = 2;
  return { mine, opponent, mineBar: 1, opponentBar: 0, mineOff: 2, opponentOff: 0 };
}

describe("mirrored numbering (homeLeft)", () => {
  it("drawnPoint swaps 1<->12 and 13<->24 within each row and is its own inverse", () => {
    expect(range(1, 12).map((p) => drawnPoint(p, true))).toEqual(range(1, 12).reverse());
    expect(range(13, 24).map((p) => drawnPoint(p, true))).toEqual(range(13, 24).reverse());
    for (const p of range(1, 24)) {
      expect(drawnPoint(drawnPoint(p, true), true)).toBe(p);
      expect(drawnPoint(p, false)).toBe(p);
    }
  });

  it("reads 1..12 left to right along the bottom and 24..13 along the top", () => {
    expect(leftToRight(range(1, 12), true)).toEqual(range(1, 12));
    expect(leftToRight(range(13, 24), true)).toEqual(range(13, 24).reverse());
    // The default board is untouched: 12..1 along the bottom, 13..24 along the top.
    expect(leftToRight(range(1, 12), false)).toEqual(range(1, 12).reverse());
    expect(leftToRight(range(13, 24), false)).toEqual(range(13, 24));
  });

  it("puts a point in an existing column at the same x and y: no column moves", () => {
    for (const p of range(1, 24)) {
      const column = drawnPoint(p, true);
      expect(stackBase(p, true)).toEqual(stackBase(column));
      expect(trianglePoints(p, true)).toBe(trianglePoints(column));
    }
  });

  it("re-maps point anchors to their column and leaves bar/off anchors alone", () => {
    for (const flipped of [false, true]) {
      for (const isOrigin of [true, false]) {
        for (const ref of ["bar", "off"] as const) {
          expect(moveAnchor(ref, decoded(), isOrigin, flipped, true)).toEqual(
            moveAnchor(ref, decoded(), isOrigin, flipped)
          );
        }
        for (const ref of [6, 19]) {
          const mirrored = moveAnchor(ref, decoded(), isOrigin, flipped, true);
          expect(mirrored.x).toBe(stackBase(drawnPoint(ref, true)).cx);
          expect(mirrored.y).toBe(moveAnchor(ref, decoded(), isOrigin, flipped).y);
        }
      }
    }
  });

  it("leaves the default board's numbers unchanged", () => {
    for (const point of range(1, 24)) {
      expect(stackBase(point, false)).toEqual(stackBase(point));
      expect(trianglePoints(point, false)).toBe(trianglePoints(point));
    }
  });
});
