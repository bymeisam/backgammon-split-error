"use client";

import { useMemo, type ReactNode } from "react";
import type { Decision } from "@/lib/mistakes";
import { decodeGnuPositionId, flipPerspective } from "@/lib/gnuPositionId";
import { parseNotation, mirrorSubMoves } from "@/lib/backgammonNotation";
import { boardCubeFor, boardPositionFlipped } from "@/lib/boardFrame";
import { playedMoveTier, type SeverityTier } from "@/lib/badges";
import { formatLoss } from "@/lib/review/format";
import SeverityBadge from "@/app/components/ui/SeverityBadge";
import Board from "./Board";
import DecisionReviewTools from "./DecisionReviewTools";
import { style, type ArrowTier } from "./BoardPanel.styles";

// One of the Played / Best chips under the board: a tab button when the
// page can switch the board between them, a static box otherwise.
function DecisionChip({
  label,
  tier,
  move,
  detail,
  loss,
  isActive,
  onSelect,
}: {
  label: string;
  tier: SeverityTier;
  move: string;
  detail: string | null | undefined;
  loss: string;
  isActive: boolean;
  onSelect?: () => void;
}) {
  const content = (
    <>
      <span className={style.decisionLabel}>
        {label} <SeverityBadge type={tier} />
      </span>
      <span className={style.decisionMove(tier)}>{move}</span>
      {detail && <span className={style.bestDetail}>{detail}</span>}
      <span className={style.decisionLoss}>{loss}</span>
    </>
  );
  if (!onSelect) {
    return <div className={style.decisionChip({ tier, isActive, isButton: false })}>{content}</div>;
  }
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onSelect}
      className={style.decisionChip({ tier, isActive, isButton: true })}
    >
      {content}
    </button>
  );
}

export default function BoardPanel({
  selected,
  moveTab,
  onSelectTab,
  flipped,
  canEditNotes = false,
  quiz = false,
  quizArrows = null,
  bleed = false,
  belowBoard,
}: {
  selected: Decision | null;
  moveTab: "my" | "best";
  // Optional: when given, the Played/Best chips below the board are tabs
  // that switch the board (DecisionCard, GameReplay); without it they're
  // static boxes (MistakesSection, which switches tabs from its lists).
  onSelectTab?: (tab: "my" | "best") => void;
  // Fixed-perspective view (GameReplay's toggle only; default false): when
  // true, `decoded`/`subMoves` are mirrored here — flipPerspective/
  // mirrorSubMoves, once, in one place — before Board sees them.
  flipped?: boolean;
  // Whether the selected decision's note is editable here (isGalaxyEnabled()
  // on the server — see DecisionNote). Default false: read-only. Also
  // decides whether "Add to review" and the tag editor are offered
  // (DecisionReviewTools).
  canEditNotes?: boolean;
  // Review card (app/review): just the position, dice and cube — no
  // Played/Best chips, no note card, nothing that gives the answer away.
  quiz?: boolean;
  // Review card back: the best move's notation, drawn as best arrows (the
  // card's own best option, which can differ from Galaxy's rank 1). Null
  // draws none (the front, and cube cards).
  quizArrows?: string | null;
  // The page has no side padding below md (replay, review): see
  // BoardPanel.styles.ts's boardWrap/inset.
  bleed?: boolean;
  // Between the board and the Played/Best chips (the replay's stepper).
  belowBoard?: ReactNode;
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

  const notation = quiz
    ? quizArrows
    : selected?.kind === "checker"
      ? moveTab === "my"
        ? selected.myMoveNotation
        : selected.bestMoveNotation
      : null;

  const subMoves = useMemo(() => {
    const parsed = notation ? parseNotation(notation) : [];
    return flipped ? mirrorSubMoves(parsed) : parsed;
  }, [notation, flipped]);

  // The played move's tier on the Played tab (lib/badges.ts's
  // playedMoveTier: a null severity is Galaxy's "Best"), best on the Best
  // tab and on a review card's back.
  const playedTier = playedMoveTier(selected?.severity ?? null);
  const arrowTier: ArrowTier = quiz || moveTab === "best" ? "best" : playedTier;

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
          <div className={style.boardWrap(bleed)}>
            <Board
              decoded={decoded}
              subMoves={subMoves}
              arrowTier={arrowTier}
              roll={selected.roll}
              flipped={flipped}
              cube={cube}
            />
          </div>
        ) : (
          <p className={style.emptyState}>No position data for this decision.</p>
        )}

        {belowBoard}

        {selected && !quiz && (
          <div
            className={style.decisionRow(bleed)}
            role={onSelectTab ? "tablist" : undefined}
            aria-label={onSelectTab ? "Move shown on the board" : undefined}
          >
            <DecisionChip
              label="Played"
              tier={playedTier}
              move={selected.myLabel}
              detail={null}
              loss={formatLoss(-selected.absError)}
              isActive={!onSelectTab || moveTab === "my"}
              onSelect={onSelectTab ? () => onSelectTab("my") : undefined}
            />
            <DecisionChip
              label="Best"
              tier="best"
              move={selected.bestLabel}
              detail={selected.bestDetail}
              loss={formatLoss(0)}
              isActive={!onSelectTab || moveTab === "best"}
              onSelect={onSelectTab ? () => onSelectTab("best") : undefined}
            />
          </div>
        )}
      </div>

      {/* Outside the board-panel testid'd box on purpose: the note card is
          its own card below the board, so e2e's board-panel screenshots stay
          about the board itself. "Add to review" and tags are in it —
          DB-backed decisions only (nothing renders without a dbDecisionId,
          e.g. on /galaxy). */}
      {selected && !quiz && (
        <DecisionReviewTools
          key={`review-${selected.dbDecisionId ?? selected.id}`}
          decision={selected}
          canEdit={canEditNotes}
          inset={bleed}
          placeholder={
            selected.isMistake ? `Why is ${selected.bestLabel} better here?` : "Your note on this decision…"
          }
        />
      )}
    </div>
  );
}
