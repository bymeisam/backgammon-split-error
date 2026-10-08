"use client";

import type { DecodedPosition } from "@/lib/gnuPositionId";
import type { ParsedSubMove } from "@/lib/backgammonNotation";
import type { BoardCube } from "@/lib/boardFrame";
import {
  BAR_COL,
  BOARD_H,
  BOARD_W,
  CUBE_BADGE_R,
  DIE_SIZE,
  MAX_STACK,
  NUMBER_BOTTOM_Y,
  NUMBER_TOP_Y,
  OFF_COL,
  OFF_SLOTS,
  OFF_TRACK_W,
  OFF_TRACK_X,
  R,
  RING_R,
  Y0,
  Y1,
  barStackBase,
  colX,
  cubeBadgeCenter,
  diePips,
  diePosition,
  isOffSlotFilled,
  moveAnchor,
  offColumnGeometry,
  offeredCubeCenter,
  offTrayBounds,
  offTrayRect,
  pointRow,
  stackBase,
  stackSlotY,
  trianglePoints,
  type Side,
  type StackBase,
} from "@/lib/boardGeometry";
import { CHECKER_PALETTE, CUBE_CONTRAST, CUBE_FILL } from "@/lib/checkerPalette";
import { style, type ArrowTier } from "./BoardPanel.styles";

// Drawn in the order of the Clubroom mockup's board() (design/mockups/
// replay.html): frame, bone, trays, points, numbers, off-tray contents,
// checkers, bar checkers, cube, arrows, dice. Every position comes from
// lib/boardGeometry.ts.

function OffTray({ side, count }: { side: Side; count: number }) {
  const { fill, contrast, rim } = CHECKER_PALETTE[side];
  const { topY, bottomY, badgeAtBottom } = offTrayBounds(side);
  const { badgeR, badgeCy, trackTop, slotSpan } = offColumnGeometry(topY, bottomY, badgeAtBottom);
  const slotH = Math.max(slotSpan - 1.5, 2);
  const cx = OFF_TRACK_X + OFF_TRACK_W / 2;
  const tray = offTrayRect(side);

  return (
    <>
      <rect x={tray.x} y={tray.y} width={tray.width} height={tray.height} rx={3} className={style.boardTray} />
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
      <text x={cx} y={badgeCy + 4} textAnchor="middle" fill={contrast} className={style.stackCount}>
        {count}
      </text>
    </>
  );
}

// Up to MAX_STACK checkers, each with its turned ring; past that, "+N" on
// the last one: N more than shown.
function Stack({ base, count, side }: { base: StackBase; count: number; side: Side }) {
  if (count <= 0) return null;
  const shown = Math.min(count, MAX_STACK);
  const { fill, contrast, rim } = CHECKER_PALETTE[side];
  const lastY = stackSlotY(base, shown - 1);

  return (
    <>
      {Array.from({ length: shown }).map((_, i) => {
        const cy = stackSlotY(base, i);
        return (
          <g key={i}>
            <circle cx={base.cx} cy={cy} r={R} fill={fill} stroke={rim} strokeWidth={1.2} />
            <circle cx={base.cx} cy={cy} r={RING_R} className={style.checkerRing(side)} />
          </g>
        );
      })}
      {count > MAX_STACK && (
        <text x={base.cx} y={lastY + 4} textAnchor="middle" fill={contrast} className={style.stackCount}>
          +{count - MAX_STACK}
        </text>
      )}
    </>
  );
}

// A 26u rounded square: the physical cube doesn't change colour when it
// changes hands, only position, so it's one neutral pair, not
// CHECKER_PALETTE's mine/opponent split. Renders nothing when `cube` is
// null (no data, or not confident — see lib/boardFrame.ts's boardCubeFor):
// a possibly-wrong number is worse than no number. An owned cube sits in
// the left gutter; an offered one (a take/pass) centred on the receiver's
// edge.
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
        rx={5}
        fill={CUBE_FILL}
        stroke={CUBE_CONTRAST}
        strokeWidth={1.2}
      />
      <text x={x} y={y + 5} textAnchor="middle" fill={CUBE_CONTRAST} className={style.cubeText}>
        {cube.value}
      </text>
    </g>
  );
}

// One die, drawn in the mover's checker colour with the other side's pips.
// Board-only: the lists' small dice are Dice.tsx.
function BoardDie({ value, index, side }: { value: number; index: number; side: Side }) {
  const { x, y } = diePosition(index);
  const s = DIE_SIZE;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={s}
        height={s}
        rx={s * 0.2}
        fill={CHECKER_PALETTE[side].fill}
        className={style.dieFrame}
      />
      {diePips(value).map(([px, py], i) => (
        <circle key={i} cx={x + px * s} cy={y + py * s} r={s * 0.09} fill={CHECKER_PALETTE[side].contrast} />
      ))}
    </g>
  );
}

// One sub-move's arrow: a shaft over a bone halo, a filled head 4u short of
// the target, and a dot on the origin (the mockup's arrow). The hit ring
// and the ×N count are the app's own.
function Arrow({ from, to, hit, count }: { from: Point; to: Point; hit: boolean; count: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const tip = { x: to.x - 4 * ux, y: to.y - 4 * uy };
  const base = { x: tip.x - 13 * ux, y: tip.y - 13 * uy };
  const nx = -uy;
  const ny = ux;
  const head = `${tip.x},${tip.y} ${base.x + 7.5 * nx},${base.y + 7.5 * ny} ${base.x - 7.5 * nx},${base.y - 7.5 * ny}`;
  return (
    <g>
      <line x1={from.x} y1={from.y} x2={base.x} y2={base.y} className={style.arrowHalo} />
      <line x1={from.x} y1={from.y} x2={base.x} y2={base.y} className={style.arrowShaft} />
      <polygon points={head} className={style.arrowHead} />
      <circle cx={from.x} cy={from.y} r={4} className={style.arrowHead} />
      {hit && <circle cx={to.x} cy={to.y} r={R + 3} className={style.arrowHit} />}
      {count > 1 && (
        <text
          x={(from.x + to.x) / 2}
          y={(from.y + to.y) / 2 - 6}
          textAnchor="middle"
          className={style.arrowCount}
        >
          ×{count}
        </text>
      )}
    </g>
  );
}

interface Point {
  x: number;
  y: number;
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
    <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} className={style.boardSvg} role="img" aria-label="Backgammon board">
      {/* The walnut frame: the outer band, the cube gutter, the bar and the
          tray column are all frame; the two playing halves are bone. */}
      <rect x={0} y={0} width={BOARD_W} height={BOARD_H} rx={14} className={style.boardFrame} />
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
        <polygon key={point} points={trianglePoints(point)} className={style.point(point % 2 === 1)} />
      ))}

      {/* point numbers, in the frame band */}
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

      {/* move arrows, in currentColor (the group's arrow token) */}
      <g className={style.arrow(arrowTier)}>
        {subMoves.map((move, i) => (
          <Arrow
            key={i}
            from={moveAnchor(move.from, decoded, true, flipped)}
            to={moveAnchor(move.to, decoded, false, flipped)}
            hit={move.hit}
            count={move.count}
          />
        ))}
      </g>

      {/* dice, in roll order, in the mover's colour (a flipped board is
          showing the opponent's turn) */}
      {roll.slice(0, 2).map((value, i) => (
        <BoardDie key={i} value={value} index={i} side={flipped ? "opponent" : "mine"} />
      ))}
    </svg>
  );
}
