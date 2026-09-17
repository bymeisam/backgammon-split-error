"use client";

import { useMemo } from "react";
import type { Decision } from "@/lib/mistakes";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";
import { parseNotation } from "@/lib/backgammonNotation";
import Board from "./Board";
import { DiceRoll } from "./Dice";

const BLUNDER_COLOR = "#dc2626"; // red-600
const ERROR_COLOR = "#d97706"; // amber-600
const BEST_COLOR = "#16a34a"; // green-600

export default function BoardPanel({
  selected,
  moveTab,
}: {
  selected: Decision | null;
  moveTab: "my" | "best";
}) {
  const decoded = useMemo(() => {
    if (!selected?.sourcePositionId) return null;
    try {
      return decodeGnuPositionId(selected.sourcePositionId);
    } catch {
      return null;
    }
  }, [selected]);

  const notation =
    selected?.kind === "checker"
      ? moveTab === "my"
        ? selected.myMoveNotation
        : selected.bestMoveNotation
      : null;

  const subMoves = useMemo(() => (notation ? parseNotation(notation) : []), [notation]);

  const arrowColor =
    moveTab === "best"
      ? BEST_COLOR
      : selected?.severity === "blunder"
        ? BLUNDER_COLOR
        : ERROR_COLOR;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-black dark:text-zinc-50">Board</h3>

      <div className="flex flex-col items-center gap-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
        {selected && selected.roll.length > 0 && (
          <div className="flex w-full justify-end">
            <DiceRoll roll={selected.roll} size={32} color="mine" />
          </div>
        )}

        {!selected ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No mistakes in this scope to show on the board.
          </p>
        ) : decoded ? (
          <Board decoded={decoded} subMoves={subMoves} arrowColor={arrowColor} />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No position data for this decision.
          </p>
        )}

        {selected && (
          <div className="flex flex-wrap items-stretch justify-center gap-2 text-xs">
            <div className="flex items-center gap-1 rounded-lg border border-black/10 bg-zinc-50 px-3 py-1.5 dark:border-white/15 dark:bg-zinc-800">
              <span className="text-zinc-500 dark:text-zinc-400">Game</span>
              <span className="font-semibold text-black dark:text-zinc-50">{selected.gameIndex}</span>
            </div>
            <div
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${
                selected.severity === "blunder"
                  ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                  : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              <span className="opacity-70">My move</span>
              <span className="font-mono font-semibold">{selected.myLabel}</span>
              <span className="opacity-70">({selected.absError.toFixed(3)})</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
              <span className="opacity-70">Best move</span>
              <span className="font-mono font-semibold">{selected.bestLabel}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
