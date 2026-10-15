// Snaps proof-of-concept: score Gemini's visual board reading against the
// user's corrected one. Both are SnapLayouts (visual, left to right as seen),
// so the orientation the user picked on the review page plays no part.

import type { SnapLayout, SnapPoint } from "./snapPocLayout";

export type SnapSymmetry = "identity" | "mirror" | "flip" | "mirrorFlip";

export const SNAP_SYMMETRIES: SnapSymmetry[] = ["identity", "mirror", "flip", "mirrorFlip"];

export const SNAP_SYMMETRY_LABELS: Record<SnapSymmetry, string> = {
  identity: "As read",
  mirror: "Left-right mirror",
  flip: "Top-bottom flip",
  mirrorFlip: "Mirror + flip",
};

export interface SnapScore {
  /** Points (of 24) with the exact colour and count, as read (identity). */
  pointsExact: number;
  /** Sum of |count difference| per point and colour, as read. */
  checkersOff: number;
  barOk: boolean;
  offOk: boolean;
  /** Same dice values, order-insensitive. */
  diceOk: boolean;
  /** Same cube value and location (a centred or hidden cube counts as 1 in the centre). */
  cubeOk: boolean;
  /** The symmetry under which Gemini's rows match the truth best. */
  bestSymmetry: SnapSymmetry;
  pointsExactBest: number;
}

/** The 24 points as [top row..., bottom row...] after applying a symmetry. */
function transformedPoints(layout: SnapLayout, symmetry: SnapSymmetry): SnapPoint[] {
  const mirror = symmetry === "mirror" || symmetry === "mirrorFlip";
  const flip = symmetry === "flip" || symmetry === "mirrorFlip";
  const row = (r: SnapPoint[]) => (mirror ? [...r].reverse() : r);
  const top = row(flip ? layout.bottomRow : layout.topRow);
  const bottom = row(flip ? layout.topRow : layout.bottomRow);
  return [...top, ...bottom];
}

function normalPoint(p: SnapPoint | undefined): SnapPoint {
  if (!p || p.color === "none" || p.count <= 0) return { color: "none", count: 0 };
  return p;
}

function pointsExact(a: SnapPoint[], b: SnapPoint[]): number {
  let n = 0;
  for (let i = 0; i < 24; i++) {
    const pa = normalPoint(a[i]);
    const pb = normalPoint(b[i]);
    if (pa.color === pb.color && pa.count === pb.count) n++;
  }
  return n;
}

function checkersOff(a: SnapPoint[], b: SnapPoint[]): number {
  let total = 0;
  for (let i = 0; i < 24; i++) {
    const pa = normalPoint(a[i]);
    const pb = normalPoint(b[i]);
    for (const color of ["light", "dark"] as const) {
      const ca = pa.color === color ? pa.count : 0;
      const cb = pb.color === color ? pb.count : 0;
      total += Math.abs(ca - cb);
    }
  }
  return total;
}

function normalCube(cube: SnapLayout["cube"]): { value: number; location: "center" | "top" | "bottom" } {
  if (!cube.visible || cube.location === "center" || cube.location === "unknown") {
    return { value: 1, location: "center" };
  }
  return { value: cube.value, location: cube.location };
}

export function scoreSnap(gemini: SnapLayout, truth: SnapLayout): SnapScore {
  const truthPoints = transformedPoints(truth, "identity");
  const asRead = transformedPoints(gemini, "identity");

  let bestSymmetry: SnapSymmetry = "identity";
  let pointsExactBest = pointsExact(asRead, truthPoints);
  for (const symmetry of SNAP_SYMMETRIES.slice(1)) {
    const n = pointsExact(transformedPoints(gemini, symmetry), truthPoints);
    if (n > pointsExactBest) {
      bestSymmetry = symmetry;
      pointsExactBest = n;
    }
  }

  const sortedDice = (d: number[]) => [...d].sort((x, y) => x - y).join(",");
  const gc = normalCube(gemini.cube);
  const tc = normalCube(truth.cube);

  return {
    pointsExact: pointsExact(asRead, truthPoints),
    checkersOff: checkersOff(asRead, truthPoints),
    barOk: gemini.bar.light === truth.bar.light && gemini.bar.dark === truth.bar.dark,
    offOk: gemini.borneOff.light === truth.borneOff.light && gemini.borneOff.dark === truth.borneOff.dark,
    diceOk: sortedDice(gemini.dice) === sortedDice(truth.dice),
    cubeOk: gc.value === tc.value && gc.location === tc.location,
    bestSymmetry,
    pointsExactBest,
  };
}
