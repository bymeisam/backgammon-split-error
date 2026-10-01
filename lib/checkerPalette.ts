import type { Side } from "@/lib/boardGeometry";

// Each side's checker colors, shared by Board.tsx and Dice.tsx so a die
// always matches its player's checkers. `contrast` is the outline/text
// color drawn on top of `fill` — checker strokes, overflow counts,
// off-tray badge text, and die pips.
export const CHECKER_PALETTE: Record<Side, { fill: string; contrast: string }> = {
  mine: { fill: "#1f2937", contrast: "#f8fafc" },
  opponent: { fill: "#f8fafc", contrast: "#1f2937" },
};
