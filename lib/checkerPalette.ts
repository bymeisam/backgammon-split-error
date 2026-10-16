import type { Side } from "@/lib/boardGeometry";

// Each side's checker colours, shared by Board.tsx and Dice.tsx so a die
// always matches its player's checkers. The values are the theme's tokens
// (app/themes/*.css), so the board follows the theme and mode; they're
// used as SVG fill/stroke attributes, which accept var(). `contrast` is
// drawn on top of `fill` (overflow counts, off-tray badge text, die pips);
// `rim` is the checker's outline.
export const CHECKER_PALETTE: Record<Side, { fill: string; contrast: string; rim: string }> = {
  mine: { fill: "var(--checker-mine)", contrast: "var(--checker-opp)", rim: "var(--checker-mine-rim)" },
  opponent: { fill: "var(--checker-opp)", contrast: "var(--checker-mine)", rim: "var(--checker-opp-rim)" },
};

// The doubling cube's own colours — unlike a checker, the physical cube
// doesn't change colour when it changes hands, only position, so this is a
// single neutral pair, not a per-side record.
export const CUBE_FILL = "var(--checker-opp)";
export const CUBE_CONTRAST = "var(--checker-mine)";

/** The side whose colours `side`'s checkers are drawn in. `swapColors` is a
 * display-only swap (app/snap-poc's "Swap colours"): each side is drawn in
 * the other side's colours, and nothing about the position changes. */
export function paletteSide(side: Side, swapColors = false): Side {
  if (!swapColors) return side;
  return side === "mine" ? "opponent" : "mine";
}

/** `side`'s checker colours, swapped with the other side's when
 * `swapColors` is on. Board uses it for checkers, bar, tray and dice. */
export function checkerColors(side: Side, swapColors = false): (typeof CHECKER_PALETTE)[Side] {
  return CHECKER_PALETTE[paletteSide(side, swapColors)];
}
