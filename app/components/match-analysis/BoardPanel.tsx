"use client";

import { useMemo } from "react";
import type { Decision } from "@/lib/mistakes";
import { decodeGnuPositionId, flipPerspective } from "@/lib/gnuPositionId";
import { parseNotation, mirrorSubMoves } from "@/lib/backgammonNotation";
import { boardCubeFor, boardPositionFlipped } from "@/lib/boardFrame";
import Board from "./Board";
import DecisionNote from "./DecisionNote";
import { style } from "./BoardPanel.styles";

const BLUNDER_COLOR = "#dc2626"; // red-600
const ERROR_COLOR = "#d97706"; // amber-600
const BEST_COLOR = "#16a34a"; // green-600

export default function BoardPanel({
  selected,
  moveTab,
  onSelectTab,
  flipped,
  canEditNotes = false,
}: {
  selected: Decision | null;
  moveTab: "my" | "best";
  // Optional: when given, the my-move/best-move boxes below the board are
  // buttons that switch tabs (DecisionCard, GameReplay); without it they're
  // static labels (MistakesSection, which switches tabs from its tables).
  onSelectTab?: (tab: "my" | "best") => void;
  // Fixed-perspective view (GameReplay's toggle only; default false): when
  // true, `decoded`/`subMoves` are mirrored here — flipPerspective/
  // mirrorSubMoves, once, in one place — before Board sees them.
  flipped?: boolean;
  // Whether the selected decision's note is editable here (isGalaxyEnabled()
  // on the server — see DecisionNote). Default false: read-only.
  canEditNotes?: boolean;
}) {
  // The position (and its cube) is flipped when exactly one of these holds:
  // the view asks for it (`flipped`), or the stored position is drawn from
  // the other player's side (a take/pass, stored from the doubler's side).
  // So the decision-maker is at the bottom on a take/pass too, and the
  // replay's fixed-perspective flip works unchanged on top of it.
  // `flipped` itself still goes to Board as-is (point numbers, dice colour,
  // arrow anchoring — all about the actor), and to mirrorSubMoves.
  const flipPosition = boardPositionFlipped(selected, flipped);

  const decoded = useMemo(() => {
    if (!selected?.sourcePositionId) return null;
    try {
      const raw = decodeGnuPositionId(selected.sourcePositionId);
      return flipPosition ? flipPerspective(raw) : raw;
    } catch {
      return null;
    }
  }, [selected, flipPosition]);

  const notation =
    selected?.kind === "checker"
      ? moveTab === "my"
        ? selected.myMoveNotation
        : selected.bestMoveNotation
      : null;

  const subMoves = useMemo(() => {
    const parsed = notation ? parseNotation(notation) : [];
    return flipped ? mirrorSubMoves(parsed) : parsed;
  }, [notation, flipped]);

  const arrowColor =
    moveTab === "best"
      ? BEST_COLOR
      : selected?.severity === "blunder"
        ? BLUNDER_COLOR
        : ERROR_COLOR;

  // The cube to draw: the owned cube, flipped with the position above, or on
  // a take/pass the offered cube at the receiver's edge — worked out once,
  // here, before Board ever sees it.
  const cube = boardCubeFor(selected, flipped);

  return (
    <div className={style.panelStack}>
      <div data-testid="board-panel" className={style.panel}>
        {!selected ? (
          <p className={style.emptyState}>No mistakes in this scope to show on the board.</p>
        ) : decoded ? (
          <Board
            decoded={decoded}
            subMoves={subMoves}
            arrowColor={arrowColor}
            roll={selected.roll}
            flipped={flipped}
            cube={cube}
          />
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
                  {selected.bestDetail && <span className={style.bestDetail}>{selected.bestDetail}</span>}
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
                  {selected.bestDetail && <span className={style.bestDetail}>{selected.bestDetail}</span>}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Outside the board-panel testid'd box on purpose: the note is its
          own card below the board, so e2e's board-panel screenshots stay
          about the board itself. */}
      {selected && (
        <DecisionNote
          key={selected.dbDecisionId ?? selected.id}
          note={selected.note}
          dbDecisionId={selected.dbDecisionId}
          canEditNotes={canEditNotes}
        />
      )}
    </div>
  );
}
