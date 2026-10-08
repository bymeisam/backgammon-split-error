"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Decision } from "@/lib/mistakes";
import { useListSelection } from "@/app/hooks/useListSelection";
import BoardPanel from "@/app/components/match-analysis/BoardPanel";
import DecisionList, { SeverityLegend } from "@/app/components/match-analysis/DecisionList";
import SeverityBadge from "@/app/components/ui/SeverityBadge";
import { doubleOfferLabel } from "@/lib/cubeState";
import { style } from "./gameReplay.styles";

// List + single-detail split, same interaction pattern as
// DecisionListWithDetail.tsx on /mistakes — client-side selection
// (useListSelection), the board column and the move list card side by side
// from 980px — applied here to a complete, unfiltered, in-order sequence
// instead of a filtered/ranked set of flagged mistakes. Under the board: the
// stepper (Prev/Next, buttons and arrow keys, crossing into the
// previous/next game at either end), the Played/Best chips and the note
// card. Clicking a list row jumps straight to it.
export default function GameReplay({
  matchId,
  decisions,
  prevGameIndex,
  nextGameIndex,
  initialIndex,
  myColor,
  canEditNotes,
}: {
  matchId: string;
  decisions: Decision[];
  prevGameIndex: number | null;
  nextGameIndex: number | null;
  initialIndex: number;
  // Resolved server-side (page.tsx) from PlayerIdentity.isMe cross-
  // referenced against this game's own decisions — null when no isMe
  // identity exists, or it never appears in this game, in which case the
  // fixed-perspective toggle below has nothing reliable to compare a
  // decision's color against and is hidden rather than offered broken.
  myColor: string | null;
  // isGalaxyEnabled(), computed by the server page — see DecisionNote.
  canEditNotes: boolean;
}) {
  const router = useRouter();
  // Positional (index) selection, not id-based like the mistakes lists —
  // initialIndex can be the last decision (?position=last), and there's no
  // "fall back to first" case, so resolveSelected doesn't apply here.
  const { selectedKey: selectedIndex, moveTab, selectRow, setMoveTab } =
    useListSelection(initialIndex);
  // Opt-in, default off: today's always-on-roll-perspective stays the
  // default (still what /mistakes' own BoardPanel usage effectively is,
  // and preferred there) — this only ever applies to this page's own
  // BoardPanel call, via the `flipped` prop below.
  const [fixedPerspective, setFixedPerspective] = useState(false);

  const selected = decisions[selectedIndex] ?? null;
  const atStart = selectedIndex <= 0;
  const atEnd = selectedIndex >= decisions.length - 1;
  // A decision "belongs to the opponent" (relative to the fixed color)
  // whenever its own resolved color differs from myColor — flip only then,
  // so "my" decisions keep rendering exactly as the always-on-roll view
  // already does (mine is already on the bottom/dark for my own turn).
  const flipped = fixedPerspective && selected !== null && selected.color !== myColor;
  // A take/pass step answers a double Galaxy didn't analyse as its own step
  // (only the receiver had a decision), so say what was offered.
  const doubleOfferText =
    selected?.doubleOffer != null
      ? doubleOfferLabel(selected.doubleOffer, myColor === null ? null : selected.color === myColor, selected.color)
      : null;

  // At a game boundary with an adjacent game available, Previous/Next cross
  // straight into it (landing on its last/first decision respectively) —
  // deliberately not a dead stop, so arrow-key browsing stays continuous
  // across a whole match, not just within one game. The separate "Next
  // game →"/"← Previous game" links below exist alongside this so crossing
  // into a different game is still visually explicit, not just a silent
  // position-counter reset.
  function goPrev() {
    if (!atStart) {
      selectRow(selectedIndex - 1);
    } else if (prevGameIndex !== null) {
      router.push(`/matches/${matchId}/replay/${prevGameIndex}?position=last`);
    }
  }

  function goNext() {
    if (!atEnd) {
      selectRow(selectedIndex + 1);
    } else if (nextGameIndex !== null) {
      router.push(`/matches/${matchId}/replay/${nextGameIndex}`);
    }
  }

  // No dependency array: re-attaches every render so the listener always
  // closes over the latest selectedIndex/decisions/prevGameIndex/
  // nextGameIndex rather than a stale first-render snapshot. Cheap — a
  // single event listener add/remove per render, not a real cost at this
  // page's scale.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const roll = selected?.roll ?? [];

  return (
    <div className={style.layout}>
      <div className={style.boardColumn}>
        <BoardPanel
          selected={selected}
          moveTab={moveTab}
          onSelectTab={setMoveTab}
          flipped={flipped}
          canEditNotes={canEditNotes}
          bleed
          belowBoard={
            <div className={style.stepper}>
              <button
                type="button"
                onClick={goPrev}
                disabled={atStart && prevGameIndex === null}
                aria-label="Previous step"
                aria-keyshortcuts="ArrowLeft"
                className={style.stepButton}
              >
                <kbd className={style.kbd}>←</kbd> Prev
              </button>
              <span className={style.where}>
                Move <b className={style.whereStrong}>{selectedIndex + 1}</b> of {decisions.length}
                {selected?.kind === "cube" ? (
                  doubleOfferText ? (
                    <span data-testid="double-offer-label"> · {doubleOfferText}</span>
                  ) : (
                    " · cube action"
                  )
                ) : roll.length === 2 ? (
                  <>
                    {" · "}
                    <b className={style.whereStrong}>
                      {roll[0]}-{roll[1]}
                    </b>{" "}
                    to play
                  </>
                ) : null}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={atEnd && nextGameIndex === null}
                aria-label="Next step"
                aria-keyshortcuts="ArrowRight"
                className={style.stepButton}
              >
                Next <kbd className={style.kbd}>→</kbd>
              </button>
              {myColor !== null && (
                <label className={style.perspectiveToggle} title="Keep my checkers on the same side">
                  <input
                    type="checkbox"
                    checked={fixedPerspective}
                    onChange={(e) => setFixedPerspective(e.target.checked)}
                  />
                  Fixed perspective
                </label>
              )}
            </div>
          }
        />
      </div>

      <DecisionList
        rows={decisions}
        title="Moves"
        headEnd={<SeverityLegend />}
        isSelected={(_row, index) => index === selectedIndex}
        moveTab={moveTab}
        onSelectRow={(_row, index, tab) => selectRow(index, tab)}
        columns="replay"
        renderTrailing={(row) =>
          row.isMistake && row.severity ? <SeverityBadge type={row.severity} /> : null
        }
        sticky
        bleed
      />
    </div>
  );
}
