import type { Side } from "@/lib/boardGeometry";

// Each side's checker colors, shared by Board.tsx and Dice.tsx so a die
// always matches its player's checkers. `contrast` is the outline/text
// color drawn on top of `fill` — checker strokes, overflow counts,
// off-tray badge text, and die pips.
export const CHECKER_PALETTE: Record<Side, { fill: string; contrast: string }> = {
  mine: { fill: "#1f2937", contrast: "#f8fafc" },
  opponent: { fill: "#f8fafc", contrast: "#1f2937" },
};

// The doubling cube's own colors — unlike a checker, the physical cube
// doesn't change color when it changes hands, only position, so this is a
// single neutral pair, not a per-side record.
export const CUBE_FILL = "#f8fafc";
export const CUBE_CONTRAST = "#1f2937";
