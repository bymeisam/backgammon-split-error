"use client";

import type { Side } from "@/lib/boardGeometry";
import { CHECKER_PALETTE } from "@/lib/checkerPalette";
import { style } from "./Dice.styles";

// Pip centres in a 100 × 100 die (the Clubroom mockup's miniDie).
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

// "mini": the move lists' neutral dice (surface face, ink pips), not
// checker-coloured — the board draws its own (Board.tsx's BoardDie).
// "checker": a die in a player's checker colours.
export type DiceVariant = "mini" | Side;

// Pip positions for a die value; none for anything outside 1-6. Values come
// from Galaxy's JSON (rolled_dice) unvalidated, so this is an own-property
// lookup — a plain PIPS[value] would resolve e.g. "toString" to an
// inherited function and crash on .map.
export function pipsFor(value: number): [number, number][] {
  return Object.hasOwn(PIPS, value) ? PIPS[value] : [];
}

function Die({ value, size, variant }: { value: number; size: number; variant: DiceVariant }) {
  const pips = pipsFor(value);
  if (variant === "mini") {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Die: ${value}`}>
        <rect x={6} y={6} width={88} height={88} rx={20} className={style.miniFace} />
        {pips.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={10} className={style.miniPip} />
        ))}
      </svg>
    );
  }
  const { fill, contrast, rim } = CHECKER_PALETTE[variant];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Die: ${value}`}>
      <rect x={4} y={4} width={92} height={92} rx={18} fill={fill} stroke={rim} strokeWidth={4} />
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={10} fill={contrast} />
      ))}
    </svg>
  );
}

export function DiceRoll({
  roll,
  size = 16,
  variant = "mini",
}: {
  roll: number[];
  size?: number;
  variant?: DiceVariant;
}) {
  if (roll.length === 0) return null;
  return (
    <span className={style.rollWrapper}>
      {roll.map((v, i) => (
        <Die key={i} value={v} size={size} variant={variant} />
      ))}
    </span>
  );
}
