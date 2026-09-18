"use client";

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

type DiceColor = "mine" | "opponent";

// Mirrors Board.tsx's MINE_FILL/MINE_STROKE/OPP_FILL/OPP_STROKE palette.
const COLORS: Record<DiceColor, { face: string; pip: string; stroke: string }> = {
  mine: { face: "#1f2937", pip: "#f8fafc", stroke: "#00000055" },
  opponent: { face: "#f8fafc", pip: "#1f2937", stroke: "#00000033" },
};

function Die({ value, size = 20, color = "opponent" }: { value: number; size?: number; color?: DiceColor }) {
  const pips = PIPS[value] ?? [];
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
    <span className="inline-flex items-center gap-1">
      {roll.map((v, i) => (
        <Die key={i} value={v} size={size} color={color} />
      ))}
    </span>
  );
}
