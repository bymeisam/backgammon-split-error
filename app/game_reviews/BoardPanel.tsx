"use client";

import { useMemo } from "react";
import type { Decision } from "@/lib/mistakes";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";
import { parseNotation } from "@/lib/backgammonNotation";
import Board from "./Board";

const BLUNDER_COLOR = "#dc2626"; // red-600
const ERROR_COLOR = "#d97706"; // amber-600
const BEST_COLOR = "#16a34a"; // green-600

export default function BoardPanel({
  selected,
  moveTab,
  onMoveTabChange,
}: {
  selected: Decision | null;
  moveTab: "my" | "best";
  onMoveTabChange: (tab: "my" | "best") => void;
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
        {selected?.kind === "checker" && (
          <div className="inline-flex w-fit rounded-full border border-black/10 bg-zinc-50 p-1 dark:border-white/15 dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => onMoveTabChange("my")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                moveTab === "my"
                  ? "bg-foreground text-background"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              My move
            </button>
            <button
              type="button"
              onClick={() => onMoveTabChange("best")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                moveTab === "best"
                  ? "bg-foreground text-background"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              Best move
            </button>
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
          <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">
            Game {selected.gameIndex} · {selected.detail} · |error| {selected.absError.toFixed(3)}
          </p>
        )}
      </div>
    </div>
  );
}
