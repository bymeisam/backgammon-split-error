"use client";

import type { DecodedPosition } from "@/lib/gnuPositionId";
import type { ParsedSubMove } from "@/lib/backgammonNotation";
import type { BoardCube } from "@/lib/boardFrame";
import {
  BAR_COL,
  BOARD_H,
  BOARD_W,
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
import { style, type ArrowTier } from "./BoardPanel.styles";

// Each side's half of the off tray (a recessed tray in the frame).
const OFF_TRAY_PANEL_Y: Record<Side, number> = {
  opponent: Y0,
  mine: Y0 + ROW_H + 3,
};

// The frame band drawn around the board's own geometry (lib/boardGeometry.ts
// is unchanged): the SVG's viewBox grows by this much on every side, so the
// point numbers sit in the frame, at a size that's readable on a phone,
// without moving anything inside the board.
const FRAME = 14;
// Centre of the frame band above and below the playing area, for the point
// numbers: the band is MARGIN (the board's own edge) plus FRAME wide.
const NUMBER_TOP_Y = (Y0 - FRAME) / 2;
const NUMBER_BOTTOM_Y = Y1 + (MARGIN + FRAME) / 2;

function OffTray({ side, count }: { side: Side; count: number }) {
  const { fill, contrast, rim } = CHECKER_PALETTE[side];
  const { topY, bottomY, badgeAtBottom } = offTrayBounds(side);
  const { badgeR, badgeCy, trackTop, slotSpan } = offColumnGeometry(topY, bottomY, badgeAtBottom);
  const slotH = Math.max(slotSpan - 1.5, 2);
  const cx = OFF_TRACK_X + OFF_TRACK_W / 2;

  return (
    <>
      <rect
        x={colX(OFF_COL) + 3}
        y={OFF_TRAY_PANEL_Y[side]}
        width={OFF_W - 6}
        height={ROW_H - 6}
        rx={4}
        className={style.boardTray}
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
            stroke={filled ? rim : undefined}
            className={filled ? undefined : style.offSlotEmpty}
            strokeWidth={1}
          />
        );
      })}
      <circle cx={cx} cy={badgeCy} r={badgeR} fill={fill} stroke={rim} strokeWidth={1.5} />
      <text x={cx} y={badgeCy + 4} textAnchor="middle" fontSize={11} fontWeight="bold" fill={contrast}>
        {count}
      </text>
    </>
  );
}

function Stack({ base, count, side }: { base: StackBase; count: number; side: Side }) {
  if (count <= 0) return null;
  const shown = Math.min(count, MAX_STACK);
  const { fill, contrast, rim } = CHECKER_PALETTE[side];

  return (
    <>
      {Array.from({ length: shown }).map((_, i) => {
        const cy = stackSlotY(base, i);
        const isOverflow = count > MAX_STACK && i === shown - 1;
        return (
          <g key={i}>
            <circle cx={base.cx} cy={cy} r={R} fill={fill} stroke={rim} strokeWidth={1.2} />
            {/* The turned ring that makes a checker read as an object. */}
            {!isOverflow && <circle cx={base.cx} cy={cy} r={R - 5} className={style.checkerRing(side)} />}
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
  arrowTier = "blunder",
  roll = [],
  flipped = false,
  cube = null,
}: {
  decoded: DecodedPosition;
  subMoves?: ParsedSubMove[];
  // The arrows' colour: the severity of the move drawn (theme tokens,
  // BoardPanel.styles.ts's arrow).
  arrowTier?: ArrowTier;
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
      viewBox={`${-FRAME} ${-FRAME} ${BOARD_W + 2 * FRAME} ${BOARD_H + 2 * FRAME}`}
      className={style.boardSvg}
      role="img"
      aria-label="Backgammon board"
    >
      {/* The walnut frame: the outer band, the cube gutter, the bar and the
          tray column are all frame; the two playing halves are bone. */}
      <rect
        x={-FRAME}
        y={-FRAME}
        width={BOARD_W + 2 * FRAME}
        height={BOARD_H + 2 * FRAME}
        rx={14}
        className={style.boardFrame}
      />
      <rect
        x={colX(0)}
        y={Y0}
        width={colX(BAR_COL) - colX(0)}
        height={Y1 - Y0}
        rx={2}
        className={style.boardSurface}
      />
      <rect
        x={colX(BAR_COL + 1)}
        y={Y0}
        width={colX(OFF_COL) - colX(BAR_COL + 1)}
        height={Y1 - Y0}
        rx={2}
        className={style.boardSurface}
      />

      {Array.from({ length: 24 }, (_, i) => i + 1).map((point) => (
        <polygon key={point} points={trianglePoints(point)} className={style.point(point % 2 === 0)} />
      ))}

      {/* point numbers, in the frame */}
      {Array.from({ length: 24 }, (_, i) => i + 1).map((point) => (
        <text
          key={point}
          x={stackBase(point).cx}
          y={pointRow(point) === "bottom" ? NUMBER_BOTTOM_Y : NUMBER_TOP_Y}
          textAnchor="middle"
          dominantBaseline="central"
          className={style.pointNumber}
        >
          {flipped ? 25 - point : point}
        </text>
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

      {/* move arrows, in currentColor (the group's arrow token, which the
          marker inherits from its ancestors), each over a bone halo so it
          stays visible across the dark points */}
      <g className={style.arrow(arrowTier)}>
        <defs>
          <marker id="board-arrowhead" markerWidth={4.5} markerHeight={4.5} refX={3.375} refY={2.25} orient="auto">
            <path d="M0,0 L4.5,2.25 L0,4.5 Z" fill="currentColor" />
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
                strokeWidth={7}
                strokeLinecap="round"
                className={style.arrowHalo}
              />
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                markerEnd="url(#board-arrowhead)"
              />
              {move.hit && (
                <circle
                  cx={to.x}
                  cy={to.y}
                  r={R + 6}
                  fill="none"
                  stroke="currentColor"
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
                  fill="currentColor"
                  strokeWidth={3}
                  paintOrder="stroke"
                  className={style.arrowCountHalo}
                >
                  ×{move.count}
                </text>
              )}
            </g>
          );
        })}
      </g>

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
