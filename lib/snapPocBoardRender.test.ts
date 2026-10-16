import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Board, { type BoardCornerGuide } from "@/app/components/match-analysis/Board";
import { style } from "@/app/components/match-analysis/BoardPanel.styles";
import {
  SNAP_CORNERS,
  boardHomeLeft,
  boardNumbersFrom,
  cornerRow,
  cornerSide,
  boardSwapColors,
  layoutToBuilderState,
  setAnalyzingFor,
  setHomeCorner,
  toggleMirrorCheckers,
  toggleRotate,
  DEFAULT_SNAP_ORIENTATION,
  type SnapCorner,
  type SnapLayout,
  type SnapOrientation,
  type SnapPoint,
} from "./snapPocLayout";

// /snap-poc's step 2: picking the home board corner on the board as drawn.
// The board is rendered with homeLeft = boardHomeLeft(o), so moving the home
// board to the other side of the same row (1<->2, 3<->4) must change only the
// point labels' text: same triangles and fills per column, same checkers,
// bar, tray, cube and dice. And Board's home board guide draws the badges
// and the wash.

const none: SnapPoint = { color: "none", count: 0 };
const L = (count: number): SnapPoint => ({ color: "light", count });
const D = (count: number): SnapPoint => ({ color: "dark", count });

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

// The board as /snap-poc's step 2 builder draws it for this orientation
// (PositionBuilder's numbersFrom = boardNumbersFrom(o): Board's flipped, and
// hit area labels that follow the printed numbers).
function render(o: SnapOrientation, opts: { onPointClick?: (point: number) => void; cornerGuide?: BoardCornerGuide } = {}): string {
  const state = layoutToBuilderState(layout(), o);
  const flipped = boardNumbersFrom(o) === "opponent";
  return renderToStaticMarkup(
    createElement(Board, {
      decoded: state.position,
      roll: state.roll ?? [],
      rollSide: state.playerToMove,
      cube: { kind: "owned", value: state.cubeValue, owner: state.cubeOwner },
      homeLeft: boardHomeLeft(o),
      swapCheckerColors: boardSwapColors(o, false),
      flipped,
      interactivePointLabel: flipped ? (point: number) => `Edit point ${25 - point}` : undefined,
      onPointClick: opts.onPointClick,
      cornerGuide: opts.cornerGuide,
    })
  );
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const labelRe = new RegExp(`(<text[^>]*class="${escapeRe(style.pointNumber)}"[^>]*>)(\\d+)(</text>)`, "g");
const labels = (svg: string) => [...svg.matchAll(labelRe)].map((m) => Number(m[2]));
// Each printed point number with where it is drawn.
const placedLabels = (svg: string) =>
  [...svg.matchAll(labelRe)].map((m) => ({
    n: Number(m[2]),
    x: Number(/\sx="([\d.]+)"/.exec(m[1])![1]),
    y: Number(/\sy="([\d.]+)"/.exec(m[1])![1]),
  }));
const withoutLabels = (svg: string) => svg.replace(labelRe, "$1#$3");
// Hit areas' aria-labels ("Edit point N"), in drawing (column) order.
const hitPoints = (svg: string) => [...svg.matchAll(/aria-label="Edit point (\d+)"/g)].map((m) => Number(m[1]));

// Every step 1 view.
const views: SnapOrientation[] = [
  DEFAULT_SNAP_ORIENTATION,
  toggleRotate(DEFAULT_SNAP_ORIENTATION),
  toggleMirrorCheckers(DEFAULT_SNAP_ORIENTATION),
  toggleRotate(toggleMirrorCheckers(DEFAULT_SNAP_ORIENTATION)),
];
const SAME_ROW: Record<SnapCorner, SnapCorner> = { 1: 2, 2: 1, 3: 4, 4: 3 };

describe("Home board corner rendering", () => {
  for (const view of views) {
    for (const color of ["dark", "light"] as const) {
      for (const corner of SNAP_CORNERS) {
        const label = `${view.rotated ? "rotated" : "unrotated"}, ${view.layoutMirrored ? "mirrored" : "plain"}, ${color}, corner ${corner}`;
        const o = setHomeCorner(setAnalyzingFor(view, color), corner);

        it(`the other side of the same row changes only the point labels (${label})`, () => {
          const before = render(o);
          const after = render(setHomeCorner(o, SAME_ROW[corner]));
          expect(after).not.toBe(before);
          expect(withoutLabels(after)).toBe(withoutLabels(before));
          // Labels come out column by column (bottom row first in point order).
          const plain = Array.from({ length: 24 }, (_, i) => i + 1);
          const mirrored = [...plain.slice(0, 12).reverse(), ...plain.slice(12).reverse()];
          const expected = boardHomeLeft(o) ? mirrored : plain;
          expect(labels(before)).toEqual(boardNumbersFrom(o) === "opponent" ? expected.map((p) => 25 - p) : expected);
        });

        it(`numbering starts from the analysed colour's home board (${label})`, () => {
          const placed = placedLabels(render(o));
          const ys = placed.map((l) => l.y);
          const rowY = cornerRow(corner) === "top" ? Math.min(...ys) : Math.max(...ys);
          const row = placed.filter((l) => l.y === rowY);
          expect(row).toHaveLength(12);
          // Outer column first: rightmost for a right corner, leftmost for a left one.
          const outward = [...row].sort((a, b) => (cornerSide(corner) === "right" ? b.x - a.x : a.x - b.x));
          expect(outward.slice(0, 6).map((l) => l.n)).toEqual([1, 2, 3, 4, 5, 6]);
          expect(outward.slice(6).map((l) => l.n)).toEqual([7, 8, 9, 10, 11, 12]);
          const otherRow = placed.filter((l) => l.y !== rowY).map((l) => l.n).sort((a, b) => a - b);
          expect(otherRow).toEqual(Array.from({ length: 12 }, (_, i) => i + 13));
        });


        it(`a click edits the point whose label is shown (${label})`, () => {
          const svg = render(o, { onPointClick: () => {} });
          expect(hitPoints(svg)).toEqual(labels(svg));
        });
      }
    }
  }
});

describe("Board's home board guide", () => {
  const titleRe = /<title>([^<]*)<\/title>/g;
  const washRe = new RegExp(`class="${escapeRe(style.cornerWash)}"`, "g");

  it("is absent unless asked for", () => {
    const svg = render(DEFAULT_SNAP_ORIENTATION);
    expect(svg).not.toContain(style.cornerBadge(true));
    expect(svg.match(washRe)).toBeNull();
  });

  it("draws the four badges, H on the selected one with its tooltip, and the wash", () => {
    const plain = render(DEFAULT_SNAP_ORIENTATION, {
      cornerGuide: { selected: 4, selectedTitle: "Dark's home board", highlighted: null },
    });
    expect([...plain.matchAll(titleRe)].map((m) => m[1])).toEqual(["Dark&#x27;s home board"]);
    const badgeTexts = [...plain.matchAll(/<text[^>]*>([1-4H])<\/text>/g)].map((m) => m[1]);
    expect(badgeTexts.slice(-4)).toEqual(["1", "2", "3", "H"]);
    expect(plain.match(washRe)).toBeNull();
    const washed = render(DEFAULT_SNAP_ORIENTATION, {
      cornerGuide: { selected: 4, selectedTitle: "Dark's home board", highlighted: 2 },
    });
    expect(washed.match(washRe)).toHaveLength(1);
  });
});
