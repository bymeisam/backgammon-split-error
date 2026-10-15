import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Board from "@/app/components/match-analysis/Board";
import { style } from "@/app/components/match-analysis/BoardPanel.styles";
import {
  layoutToBuilderState,
  toggleMirrorNumbers,
  type SnapLayout,
  type SnapOrientation,
  type SnapPoint,
} from "./snapPocLayout";

// /snap-poc's "Mirror numbers": the board is rendered with
// homeLeft = mirroredNumbers from a layout re-mapped with the flipped
// bottomHome. The rendered SVG must be the same apart from the point labels'
// text: same triangles and fills per column, same checkers, bar, tray, cube
// and dice.

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

// The board as /snap-poc's builder draws it for this orientation.
function render(o: SnapOrientation, onPointClick?: (point: number) => void): string {
  const state = layoutToBuilderState(layout(), o);
  return renderToStaticMarkup(
    createElement(Board, {
      decoded: state.position,
      roll: state.roll ?? [],
      rollSide: state.playerToMove,
      cube: { kind: "owned", value: state.cubeValue, owner: state.cubeOwner },
      homeLeft: Boolean(o.mirroredNumbers),
      onPointClick,
    })
  );
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const labelRe = new RegExp(`(<text[^>]*class="${escapeRe(style.pointNumber)}"[^>]*>)(\\d+)(</text>)`, "g");
const labels = (svg: string) => [...svg.matchAll(labelRe)].map((m) => Number(m[2]));
const withoutLabels = (svg: string) => svg.replace(labelRe, "$1#$3");
// Hit areas' aria-labels ("Edit point N"), in drawing (column) order.
const hitPoints = (svg: string) => [...svg.matchAll(/aria-label="Edit point (\d+)"/g)].map((m) => Number(m[1]));

const orientations: SnapOrientation[] = [
  { bottomColor: "dark", bottomHome: "right" },
  { bottomColor: "light", bottomHome: "left" },
  { bottomColor: "dark", bottomHome: "left", mirroredNumbers: true },
];

describe("Mirror numbers rendering", () => {
  for (const o of orientations) {
    const label = `${o.bottomColor} bottom, home ${o.bottomHome}, numbers ${o.mirroredNumbers ? "mirrored" : "plain"}`;

    it(`changes only the point labels' text (${label})`, () => {
      const before = render(o);
      const after = render(toggleMirrorNumbers(o));
      expect(after).not.toBe(before);
      expect(withoutLabels(after)).toBe(withoutLabels(before));
      // Labels come out column by column (bottom row first in point order).
      const plain = Array.from({ length: 24 }, (_, i) => i + 1);
      const mirrored = [...plain.slice(0, 12).reverse(), ...plain.slice(12).reverse()];
      expect(labels(before)).toEqual(o.mirroredNumbers ? mirrored : plain);
      expect(labels(after)).toEqual(o.mirroredNumbers ? plain : mirrored);
    });

    it(`a click edits the point whose label is shown (${label})`, () => {
      for (const orientation of [o, toggleMirrorNumbers(o)]) {
        const svg = render(orientation, () => {});
        expect(hitPoints(svg)).toEqual(labels(svg));
      }
    });
  }
});
