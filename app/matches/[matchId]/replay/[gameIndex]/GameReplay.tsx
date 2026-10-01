"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Decision } from "@/lib/mistakes";
import { useListSelection } from "@/app/hooks/useListSelection";
import BoardPanel from "@/app/components/match-analysis/BoardPanel";
import MoveDelta from "@/app/components/match-analysis/MoveDelta";
import { DiceRoll } from "@/app/components/match-analysis/Dice";
import { style } from "./gameReplay.styles";

// List + single-detail split, same interaction pattern as
// DecisionListWithDetail.tsx on /mistakes — client-side selection
// (useListSelection), board panel and list laid out side-by-side via
// lg:flex-row — applied here to a complete, unfiltered, in-order sequence
// instead of a filtered/ranked set of flagged mistakes. Next/Previous
// (buttons + arrow keys) step through that same selection one at a time;
// clicking a list row jumps straight to it, exactly like the mistakes list.
export default function GameReplay({
  matchId,
  decisions,
  prevGameIndex,
  nextGameIndex,
  initialIndex,
  myColor,
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

  return (
    <div className={style.layout}>
      <div className={style.boardColumn}>
        <BoardPanel selected={selected} moveTab={moveTab} onSelectTab={setMoveTab} flipped={flipped} />

        {myColor !== null && (
          <label className={style.perspectiveToggle}>
            <input
              type="checkbox"
              checked={fixedPerspective}
              onChange={(e) => setFixedPerspective(e.target.checked)}
            />
            Fixed perspective (keep my checkers on the same side)
          </label>
        )}

        <div className={style.navRow}>
          <button
            type="button"
            onClick={goPrev}
            disabled={atStart && prevGameIndex === null}
            className={style.navButton}
          >
            ← Previous
          </button>
          <span className={style.positionCounter}>
            Move {selectedIndex + 1} of {decisions.length}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={atEnd && nextGameIndex === null}
            className={style.navButton}
          >
            Next →
          </button>
        </div>

        {atStart && prevGameIndex !== null && (
          <div className={style.gameBoundaryRow}>
            <Link
              href={`/matches/${matchId}/replay/${prevGameIndex}?position=last`}
              className={style.gameBoundaryLink}
            >
              ← Previous game
            </Link>
          </div>
        )}
        {atEnd && nextGameIndex !== null && (
          <div className={style.gameBoundaryRow}>
            <Link href={`/matches/${matchId}/replay/${nextGameIndex}`} className={style.gameBoundaryLink}>
              Next game →
            </Link>
          </div>
        )}
      </div>

      <div className={style.listWrapper}>
        <div className={style.listScroll}>
          <table className={style.listTable}>
            <thead>
              <tr className={style.listHeadRow}>
                <th className={style.tableCell}>#</th>
                <th className={style.tableCell}>Roll</th>
                <th className={style.tableCell}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d, index) => (
                <tr
                  key={d.id}
                  onClick={() => selectRow(index)}
                  className={style.listRow(index === selectedIndex)}
                >
                  <td className={style.indexCell}>{index + 1}</td>
                  <td className={style.rollCell}>
                    <DiceRoll roll={d.roll} size={16} />
                  </td>
                  <td className={style.listDetailCell}>
                    <MoveDelta
                      decision={d}
                      activeTab={index === selectedIndex ? moveTab : null}
                      onSelectTab={(tab) => selectRow(index, tab)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
