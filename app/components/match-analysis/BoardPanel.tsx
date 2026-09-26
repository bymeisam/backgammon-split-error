"use client";

import { useMemo } from "react";
import type { Decision } from "@/lib/mistakes";
import { decodeGnuPositionId } from "@/lib/gnuPositionId";
import { parseNotation } from "@/lib/backgammonNotation";
import Board from "./Board";
import { style } from "./BoardPanel.styles";

const BLUNDER_COLOR = "#dc2626"; // red-600
const ERROR_COLOR = "#d97706"; // amber-600
const BEST_COLOR = "#16a34a"; // green-600

export default function BoardPanel({
  selected,
  moveTab,
  onSelectTab,
}: {
  selected: Decision | null;
  moveTab: "my" | "best";
  // Optional: when provided, the my-move/best-move boxes below the board
  // become the click target for switching tabs (used by
  // app/mistakes/DecisionCard.tsx, whose own separate toggle buttons were
  // removed as redundant with this). Left undefined, this renders exactly
  // as before — MistakesSection.tsx's usage is untouched.
  onSelectTab?: (tab: "my" | "best") => void;
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
    <div className={style.panelStack}>
      <div data-testid="board-panel" className={style.panel}>
        {!selected ? (
          <p className={style.emptyState}>No mistakes in this scope to show on the board.</p>
        ) : decoded ? (
          <Board decoded={decoded} subMoves={subMoves} arrowColor={arrowColor} roll={selected.roll} />
        ) : (
          <p className={style.emptyState}>No position data for this decision.</p>
        )}

        {selected && (
          <div className={style.infoRow}>
            <div className={style.gameBadge}>
              <span className={style.gameBadgeLabel}>Game</span>
              <span className={style.gameBadgeValue}>{selected.gameIndex}</span>
            </div>
            {onSelectTab ? (
              <>
                <button
                  type="button"
                  onClick={() => onSelectTab("my")}
                  className={style.myMoveBadge({ severity: selected.severity, isActive: moveTab === "my" })}
                >
                  <span className={style.moveNotation}>{selected.myLabel}</span>
                  <span className={style.mutedLabel}>({selected.absError.toFixed(3)})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTab("best")}
                  className={style.bestMoveButton(moveTab === "best")}
                >
                  <span className={style.moveNotation}>{selected.bestLabel}</span>
                </button>
              </>
            ) : (
              <>
                <div className={style.myMoveStatic(selected.severity)}>
                  <span className={style.mutedLabel}>My move</span>
                  <span className={style.moveNotation}>{selected.myLabel}</span>
                  <span className={style.mutedLabel}>({selected.absError.toFixed(3)})</span>
                </div>
                <div className={style.bestMoveStatic}>
                  <span className={style.mutedLabel}>Best move</span>
                  <span className={style.moveNotation}>{selected.bestLabel}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
