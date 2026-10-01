"use client";

import type { Side } from "@/lib/boardGeometry";
import { CHECKER_PALETTE } from "@/lib/checkerPalette";
import { style } from "./Dice.styles";

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

type DiceColor = Side;

// Face/pip come from the board's own checker palette, so a die always
// matches its player's checkers; only the die outline is dice-specific.
const COLORS: Record<DiceColor, { face: string; pip: string; stroke: string }> = {
  mine: { face: CHECKER_PALETTE.mine.fill, pip: CHECKER_PALETTE.mine.contrast, stroke: "#00000055" },
  opponent: {
    face: CHECKER_PALETTE.opponent.fill,
    pip: CHECKER_PALETTE.opponent.contrast,
    stroke: "#00000033",
  },
};

// Pip positions for a die value; none for anything outside 1-6. Values come
// from Galaxy's JSON (rolled_dice) unvalidated, so this is an own-property
// lookup — a plain PIPS[value] would resolve e.g. "toString" to an
// inherited function and crash on .map.
export function pipsFor(value: number): [number, number][] {
  return Object.hasOwn(PIPS, value) ? PIPS[value] : [];
}

function Die({ value, size = 20, color = "opponent" }: { value: number; size?: number; color?: DiceColor }) {
  const pips = pipsFor(value);
  const { face, pip, stroke } = COLORS[color];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Die: ${value}`}>
      <rect x={4} y={4} width={92} height={92} rx={18} fill={face} stroke={stroke} strokeWidth={4} />
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={10} fill={pip} />
      ))}
    </svg>
  );
}

export function DiceRoll({
  roll,
  size = 20,
  color = "opponent",
}: {
  roll: number[];
  size?: number;
  color?: DiceColor;
}) {
  if (roll.length === 0) return null;
  return (
    <span className={style.rollWrapper}>
      {roll.map((v, i) => (
        <Die key={i} value={v} size={size} color={color} />
      ))}
    </span>
  );
}
