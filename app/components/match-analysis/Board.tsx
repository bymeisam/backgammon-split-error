"use client";

import type { DecodedPosition } from "@/lib/gnuPositionId";
import type { ParsedSubMove } from "@/lib/backgammonNotation";
import type { BoardCube } from "@/lib/boardFrame";
import {
  BAR_COL,
  BOARD_H,
  BOARD_W,
  COL_WIDTHS,
  CUBE_BADGE_R,
  DICE_BOX_H,
  DICE_BOX_W,
  DICE_X,
  DICE_Y,
  MARGIN,
  MAX_STACK,
  OFF_COL,
  OFF_SLOTS,
  OFF_TRACK_W,
  OFF_TRACK_X,
  OFF_W,
  R,
  ROW_H,
  Y0,
  Y1,
  barStackBase,
  colX,
  cubeBadgeCenter,
  isOffSlotFilled,
  moveAnchor,
  offColumnGeometry,
  offeredCubeCenter,
  offTrayBounds,
  pointRow,
  stackBase,
  stackSlotY,
  trianglePoints,
  type Side,
  type StackBase,
} from "@/lib/boardGeometry";
import { CHECKER_PALETTE, CUBE_CONTRAST, CUBE_FILL } from "@/lib/checkerPalette";
import { DiceRoll } from "./Dice";
import { style } from "./BoardPanel.styles";

// Background panel behind each side's off-tray half.
const OFF_TRAY_PANEL: Record<Side, { y: number; fill: string }> = {
  opponent: { y: Y0, fill: "#ffffff55" },
  mine: { y: Y0 + ROW_H + 3, fill: "#00000022" },
};

function OffTray({ side, count }: { side: Side; count: number }) {
  const { fill, contrast } = CHECKER_PALETTE[side];
  const { topY, bottomY, badgeAtBottom } = offTrayBounds(side);
  const { badgeR, badgeCy, trackTop, slotSpan } = offColumnGeometry(topY, bottomY, badgeAtBottom);
  const slotH = Math.max(slotSpan - 1.5, 2);
  const cx = OFF_TRACK_X + OFF_TRACK_W / 2;
  const panel = OFF_TRAY_PANEL[side];

  return (
    <>
      <rect
        x={colX(OFF_COL) + 3}
        y={panel.y}
        width={OFF_W - 6}
        height={ROW_H - 6}
        rx={4}
        fill={panel.fill}
        stroke="#00000033"
      />
      {Array.from({ length: OFF_SLOTS }).map((_, i) => {
        const filled = isOffSlotFilled(i, count, badgeAtBottom);
        return (
          <rect
            key={i}
            x={OFF_TRACK_X}
            y={trackTop + i * slotSpan}
            width={OFF_TRACK_W}
            height={slotH}
            rx={1}
            fill={filled ? fill : "transparent"}
            stroke={filled ? contrast : "#00000022"}
            strokeWidth={1}
          />
        );
      })}
      <circle cx={cx} cy={badgeCy} r={badgeR} fill={fill} stroke={contrast} strokeWidth={1.5} />
      <text x={cx} y={badgeCy + 4} textAnchor="middle" fontSize={11} fontWeight="bold" fill={contrast}>
        {count}
      </text>
    </>
  );
}

function Stack({ base, count, side }: { base: StackBase; count: number; side: Side }) {
  if (count <= 0) return null;
  const shown = Math.min(count, MAX_STACK);
  const { fill, contrast } = CHECKER_PALETTE[side];

  return (
    <>
      {Array.from({ length: shown }).map((_, i) => {
        const cy = stackSlotY(base, i);
        const isOverflow = count > MAX_STACK && i === shown - 1;
        return (
          <g key={i}>
            <circle cx={base.cx} cy={cy} r={R} fill={fill} stroke={contrast} strokeWidth={1.5} />
            {isOverflow && (
              <text
                x={base.cx}
                y={cy + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight="bold"
                fill={contrast}
              >
                +{count - shown + 1}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

// Rounded-square badge, deliberately not a circle — reads as a distinct
// shape from checkers and off-tray count badges. Neutral coloring (not
// CHECKER_PALETTE's mine/opponent split): the physical cube doesn't change
// color when it changes hands, only position does. Renders nothing when
// `cube` is null (no data, or not confident — see lib/boardFrame.ts's
// boardCubeFor): a possibly-wrong number is worse than no number. An owned
// cube sits in the left gutter; an offered one (a take/pass) centred on the
// receiver's edge.
function Cube({ cube }: { cube: BoardCube | null }) {
  if (!cube) return null;
  const { x, y } = cube.kind === "offered" ? offeredCubeCenter(cube.side) : cubeBadgeCenter(cube.owner);
  return (
    <g>
      <rect
        x={x - CUBE_BADGE_R}
        y={y - CUBE_BADGE_R}
        width={CUBE_BADGE_R * 2}
        height={CUBE_BADGE_R * 2}
        rx={4}
        fill={CUBE_FILL}
        stroke={CUBE_CONTRAST}
        strokeWidth={1.5}
      />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={13} fontWeight="bold" fill={CUBE_CONTRAST}>
        {cube.value}
      </text>
    </g>
  );
}

export default function Board({
  decoded,
  subMoves = [],
  arrowColor = "#dc2626",
  roll = [],
  flipped = false,
  cube = null,
}: {
  decoded: DecodedPosition;
  subMoves?: ParsedSubMove[];
  arrowColor?: string;
  roll?: number[];
  // Checker positions and arrow anchoring both come from `decoded`/
  // `subMoves` as given — BoardPanel.tsx applies flipPerspective/
  // mirrorSubMoves to them *before* they arrive here when a
  // fixed-perspective view is active. This prop's direct effects here are
  // the printed point-number label (the fixed physical loop index below,
  // not derived from `decoded`, so a data-only transform upstream can't
  // correct it), the dice color (a flipped board is showing the
  // opponent's turn), and telling moveAnchor which side's data is the
  // mover's. Default false — only the replay's BoardPanel ever sets it.
  flipped?: boolean;
  // Already relativized and flipped (if applicable) by BoardPanel.tsx — see
  // lib/boardFrame.ts's boardCubeFor. Default null renders no cube at all
  // (e.g. no selected decision yet), not a centered one.
  cube?: BoardCube | null;
}) {
  return (
    <svg
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      className={style.boardSvg}
      role="img"
      aria-label="Backgammon board"
    >
      <rect x={0} y={0} width={BOARD_W} height={BOARD_H} rx={10} fill="#f5ecd9" />

      <rect
        x={colX(BAR_COL)}
        y={Y0}
        width={COL_WIDTHS[BAR_COL]}
        height={Y1 - Y0}
        fill="#c89f6c"
      />
      <line x1={MARGIN} y1={Y0 + ROW_H} x2={BOARD_W - MARGIN} y2={Y0 + ROW_H} stroke="#00000022" />

      {Array.from({ length: 24 }, (_, i) => i + 1).map((point) => (
        <g key={point}>
          <polygon
            points={trianglePoints(point)}
            fill={point % 2 === 0 ? "#8b5e34" : "#c89f6c"}
          />
        </g>
      ))}

      {/* off tray halves */}
      <OffTray side="opponent" count={decoded.opponentOff} />
      <OffTray side="mine" count={decoded.mineOff} />

      {/* point checkers */}
      {Array.from({ length: 24 }, (_, i) => i + 1).map((point) => {
        const mineCount = decoded.mine[point - 1];
        const oppCount = decoded.opponent[point - 1];
        const base = stackBase(point);
        return (
          <g key={point}>
            {mineCount > 0 && <Stack base={base} count={mineCount} side="mine" />}
            {oppCount > 0 && <Stack base={base} count={oppCount} side="opponent" />}
            <text
              x={base.cx}
              y={pointRow(point) === "bottom" ? Y1 + 12 : Y0 - 4}
              textAnchor="middle"
              fontSize={9}
              fill="#57534e"
            >
              {flipped ? 25 - point : point}
            </text>
          </g>
        );
      })}

      {/* bar checkers */}
      {decoded.mineBar > 0 && <Stack base={barStackBase("mine")} count={decoded.mineBar} side="mine" />}
      {decoded.opponentBar > 0 && (
        <Stack base={barStackBase("opponent")} count={decoded.opponentBar} side="opponent" />
      )}

      {/* doubling cube — after the bar checkers, so an offered cube (drawn
          on the bar column at the receiver's edge) stays visible over a
          checker on the bar. An owned cube sits in the empty left gutter,
          so the order doesn't matter for it. */}
      <Cube cube={cube} />

      {/* move arrows */}
      <defs>
        <marker id="board-arrowhead" markerWidth={4.5} markerHeight={4.5} refX={3.375} refY={2.25} orient="auto">
          <path d="M0,0 L4.5,2.25 L0,4.5 Z" fill={arrowColor} />
        </marker>
      </defs>
      {subMoves.map((move, i) => {
        const from = moveAnchor(move.from, decoded, true, flipped);
        const to = moveAnchor(move.to, decoded, false, flipped);
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;

        return (
          <g key={i}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={arrowColor}
              strokeWidth={3}
              strokeLinecap="round"
              markerEnd="url(#board-arrowhead)"
              opacity={0.85}
            />
            {move.hit && (
              <circle
                cx={to.x}
                cy={to.y}
                r={R + 6}
                fill="none"
                stroke={arrowColor}
                strokeWidth={2}
                strokeDasharray="3 2"
              />
            )}
            {move.count > 1 && (
              <text
                x={midX}
                y={midY - 6}
                textAnchor="middle"
                fontSize={11}
                fontWeight="bold"
                fill={arrowColor}
                stroke="#f5ecd9"
                strokeWidth={3}
                paintOrder="stroke"
              >
                ×{move.count}
              </text>
            )}
          </g>
        );
      })}

      {roll.length > 0 && (
        <foreignObject x={DICE_X} y={DICE_Y} width={DICE_BOX_W} height={DICE_BOX_H}>
          <div className={style.diceWrapper}>
            <DiceRoll roll={roll} size={28} color={flipped ? "opponent" : "mine"} />
          </div>
        </foreignObject>
      )}
    </svg>
  );
}
