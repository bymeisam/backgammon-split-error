"use client";

import type { DecodedPosition } from "@/lib/gnuPositionId";
import type { ParsedSubMove } from "@/lib/backgammonNotation";

const MARGIN = 16;
const POINT_W = 48;
const BAR_W = 32;
const OFF_W = 44;
const ROW_H = 185;
const TRI_H = 165;
const R = 14;
const STACK_GAP = 24;
const MAX_STACK = 5;

// Column order left-to-right for BOTH rows (bar-aligned): 6 points, bar, 6 points, off-tray.
const COL_WIDTHS = [
  POINT_W, POINT_W, POINT_W, POINT_W, POINT_W, POINT_W,
  BAR_W,
  POINT_W, POINT_W, POINT_W, POINT_W, POINT_W, POINT_W,
  OFF_W,
];
const BAR_COL = 6;
const OFF_COL = 13;

function colX(col: number): number {
  let x = MARGIN;
  for (let i = 0; i < col; i++) x += COL_WIDTHS[i];
  return x;
}
const BOARD_W = colX(COL_WIDTHS.length) + MARGIN;
const Y0 = MARGIN;
const Y1 = MARGIN + 2 * ROW_H;
const BOARD_H = Y1 + MARGIN;

function colCenterX(col: number): number {
  return colX(col) + COL_WIDTHS[col] / 2;
}

// Bottom row = points 1-12 (right-to-left: 6..1 next to bar, 12..7 on the outside).
// Top row = points 13-24 (left-to-right: 13..18 on the outside, 19..24 next to bar).
function pointColumn(point: number): number {
  if (point >= 1 && point <= 6) return 13 - point;
  if (point >= 7 && point <= 12) return 12 - point;
  if (point >= 13 && point <= 18) return point - 13;
  return point - 12;
}
function pointRow(point: number): "bottom" | "top" {
  return point <= 12 ? "bottom" : "top";
}

function trianglePoints(point: number): string {
  const col = pointColumn(point);
  const cx = colCenterX(col);
  const halfW = COL_WIDTHS[col] / 2 - 2;
  const row = pointRow(point);
  if (row === "bottom") {
    return `${cx - halfW},${Y1} ${cx + halfW},${Y1} ${cx},${Y1 - TRI_H}`;
  }
  return `${cx - halfW},${Y0} ${cx + halfW},${Y0} ${cx},${Y0 + TRI_H}`;
}

function stackBase(point: number): { cx: number; baseY: number; dir: 1 | -1 } {
  const col = pointColumn(point);
  const cx = colCenterX(col);
  const row = pointRow(point);
  return row === "bottom"
    ? { cx, baseY: Y1 - R - 3, dir: -1 }
    : { cx, baseY: Y0 + R + 3, dir: 1 };
}

type PointRef = number | "bar" | "off";

function anchorFor(ref: PointRef): { x: number; y: number } {
  if (ref === "bar") {
    return { x: colCenterX(BAR_COL), y: Y1 - TRI_H * 0.3 };
  }
  if (ref === "off") {
    return { x: colCenterX(OFF_COL), y: Y1 - 40 };
  }
  const col = pointColumn(ref);
  const cx = colCenterX(col);
  const row = pointRow(ref);
  return { x: cx, y: row === "bottom" ? Y1 - TRI_H * 0.5 : Y0 + TRI_H * 0.5 };
}

const MINE_FILL = "#1f2937";
const MINE_STROKE = "#f8fafc";
const OPP_FILL = "#f8fafc";
const OPP_STROKE = "#1f2937";

function Stack({
  cx,
  baseY,
  dir,
  count,
  fill,
  stroke,
}: {
  cx: number;
  baseY: number;
  dir: 1 | -1;
  count: number;
  fill: string;
  stroke: string;
}) {
  if (count <= 0) return null;
  const shown = Math.min(count, MAX_STACK);
  const labelColor = fill === MINE_FILL ? "#f8fafc" : "#1f2937";

  return (
    <>
      {Array.from({ length: shown }).map((_, i) => {
        const cy = baseY + dir * i * STACK_GAP;
        const isOverflow = count > MAX_STACK && i === shown - 1;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={R} fill={fill} stroke={stroke} strokeWidth={1.5} />
            {isOverflow && (
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight="bold"
                fill={labelColor}
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

export default function Board({
  decoded,
  subMoves = [],
}: {
  decoded: DecodedPosition;
  subMoves?: ParsedSubMove[];
}) {
  return (
    <svg
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      className="w-full max-w-2xl"
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
      <rect
        x={colX(OFF_COL) + 3}
        y={Y0}
        width={OFF_W - 6}
        height={ROW_H - 6}
        rx={4}
        fill="#ffffff55"
        stroke="#00000033"
      />
      <text
        x={colCenterX(OFF_COL)}
        y={Y0 + 18}
        textAnchor="middle"
        fontSize={10}
        fill="#1f2937"
      >
        OFF
      </text>
      <text
        x={colCenterX(OFF_COL)}
        y={Y0 + ROW_H / 2 + 6}
        textAnchor="middle"
        fontSize={22}
        fontWeight="bold"
        fill={OPP_STROKE}
      >
        {decoded.opponentOff}
      </text>

      <rect
        x={colX(OFF_COL) + 3}
        y={Y0 + ROW_H + 3}
        width={OFF_W - 6}
        height={ROW_H - 6}
        rx={4}
        fill="#00000022"
        stroke="#00000033"
      />
      <text
        x={colCenterX(OFF_COL)}
        y={Y1 - 8}
        textAnchor="middle"
        fontSize={10}
        fill="#1f2937"
      >
        OFF
      </text>
      <text
        x={colCenterX(OFF_COL)}
        y={Y0 + ROW_H + ROW_H / 2 + 6}
        textAnchor="middle"
        fontSize={22}
        fontWeight="bold"
        fill={MINE_FILL}
      >
        {decoded.mineOff}
      </text>

      {/* point checkers */}
      {Array.from({ length: 24 }, (_, i) => i + 1).map((point) => {
        const mineCount = decoded.mine[point - 1];
        const oppCount = decoded.opponent[point - 1];
        const { cx, baseY, dir } = stackBase(point);
        return (
          <g key={point}>
            {mineCount > 0 && (
              <Stack cx={cx} baseY={baseY} dir={dir} count={mineCount} fill={MINE_FILL} stroke={MINE_STROKE} />
            )}
            {oppCount > 0 && (
              <Stack cx={cx} baseY={baseY} dir={dir} count={oppCount} fill={OPP_FILL} stroke={OPP_STROKE} />
            )}
            <text
              x={cx}
              y={pointRow(point) === "bottom" ? Y1 + 12 : Y0 - 4}
              textAnchor="middle"
              fontSize={9}
              fill="#57534e"
            >
              {point}
            </text>
          </g>
        );
      })}

      {/* bar checkers */}
      {decoded.mineBar > 0 && (
        <Stack
          cx={colCenterX(BAR_COL)}
          baseY={Y1 - R - 3}
          dir={-1}
          count={decoded.mineBar}
          fill={MINE_FILL}
          stroke={MINE_STROKE}
        />
      )}
      {decoded.opponentBar > 0 && (
        <Stack
          cx={colCenterX(BAR_COL)}
          baseY={Y0 + R + 3}
          dir={1}
          count={decoded.opponentBar}
          fill={OPP_FILL}
          stroke={OPP_STROKE}
        />
      )}

      {/* move arrows */}
      <defs>
        <marker id="board-arrowhead" markerWidth={8} markerHeight={8} refX={6} refY={4} orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#dc2626" />
        </marker>
      </defs>
      {subMoves.map((move, i) => {
        const from = anchorFor(move.from);
        const to = anchorFor(move.to);
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const shortenBy = R + 6;
        const ux = dx / dist;
        const uy = dy / dist;
        const tipX = to.x - ux * shortenBy;
        const tipY = to.y - uy * shortenBy;
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;

        return (
          <g key={i}>
            <line
              x1={from.x}
              y1={from.y}
              x2={tipX}
              y2={tipY}
              stroke="#dc2626"
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
                stroke="#dc2626"
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
                fill="#dc2626"
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
    </svg>
  );
}
