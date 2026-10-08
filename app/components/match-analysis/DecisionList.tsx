"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Decision } from "@/lib/mistakes";
import type { MoveTab } from "@/lib/listSelection";
import { useDecisionNotes } from "@/app/providers/DecisionNotesProvider";
import { DiceRoll } from "./Dice";
import MoveDelta from "./MoveDelta";
import { style, type ListColumns } from "./DecisionList.styles";

interface DecisionListProps {
  rows: Decision[];
  // The card's head: an overline title on the left and, on the right,
  // `headEnd` (the severity legend, or "Select all / Select none").
  title: string;
  headEnd?: ReactNode;
  // Shown instead of the rows when rows.length === 0.
  emptyMessage?: string;

  isSelected: (row: Decision, index: number) => boolean;
  moveTab: MoveTab;
  onSelectRow: (row: Decision, index: number, tab?: MoveTab) => void;

  // The leading columns: "replay" (index, dice), "match" (checkbox, dice) or
  // "plain" (none). "match" needs isChecked and onToggleCheck.
  columns?: ListColumns;
  // What to show in the dice cell when a row has no roll and isn't a cube
  // row (which shows its cube square instead).
  rollEmptyPlaceholder?: ReactNode;
  isChecked?: (row: Decision) => boolean;
  onToggleCheck?: (row: Decision) => void;
  // The row's right-hand cell (severity chip, loss, classification code).
  renderTrailing?: (row: Decision) => ReactNode;
  // Sticky beside the board on wide screens (the replay's list).
  sticky?: boolean;
  // Square and edge to edge below md (a page without side padding there).
  bleed?: boolean;
}

// The legend in a list card's head: what the move colours mean.
export function SeverityLegend() {
  return (
    <span className={style.legend}>
      <span className={style.legendItem}>
        <span className={style.legendSwatch("good")} aria-hidden="true" />
        Good
      </span>
      <span className={style.legendItem}>
        <span className={style.legendSwatch("error")} aria-hidden="true" />
        Error
      </span>
      <span className={style.legendItem}>
        <span className={style.legendSwatch("blunder")} aria-hidden="true" />
        Blunder
      </span>
    </span>
  );
}

// The move list card, shared by GameReplay (the whole game), MistakesSection
// (the match page's checker and cube mistakes) and DecisionListWithDetail
// (/mistakes, /repeated-positions). Each row: optional index or checkbox,
// dice (or a cube square), the played move with a "best …" line under it
// when it wasn't the best, and a caller-chosen right-hand cell.
// Deliberately NOT responsible for selection/tick state: each caller keeps
// its own useListSelection/useTickSet (their key types differ — two callers
// select by Decision.id, GameReplay by array index) and passes plain
// callbacks down instead.
export default function DecisionList({
  rows,
  title,
  headEnd,
  emptyMessage,
  isSelected,
  moveTab,
  onSelectRow,
  columns = "plain",
  rollEmptyPlaceholder,
  isChecked,
  onToggleCheck,
  renderTrailing,
  sticky = false,
  bleed = false,
}: DecisionListProps) {
  // A note saved in this tab wins over the row's own (possibly stale) note
  // — same rule as DecisionNote's useEffectiveNote, applied per row here.
  const { savedNotes } = useDecisionNotes();

  // Keep the selected row in view: on mount and whenever the selection
  // changes, scroll the list's own scroller (never the page) so the row
  // sits in its top third. A list that doesn't scroll inside itself is
  // left alone (scrollTo is a no-op there). The first scroll (on mount) is
  // instant, so a page doesn't animate on load; later ones are smooth
  // unless the user prefers reduced motion.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  const selectedIndex = rows.findIndex((row, index) => isSelected(row, index));
  useEffect(() => {
    const list = scrollerRef.current;
    if (!list || selectedIndex < 0) return;
    const row = list.querySelector<HTMLElement>('tr[aria-current="true"]');
    if (!row) return;
    const rowTop = row.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({
      top: Math.max(0, rowTop - list.clientHeight / 3),
      behavior: reduceMotion || !hasScrolledRef.current ? "instant" : "smooth",
    });
    hasScrolledRef.current = true;
  }, [selectedIndex, rows.length]);
  const hasNote = (row: Decision): boolean => {
    const id = row.dbDecisionId;
    const note = id != null && savedNotes.has(id) ? savedNotes.get(id) : row.note;
    return Boolean(note);
  };

  return (
    <section className={style.card({ sticky, bleed })} aria-label={title}>
      <div className={style.head}>
        <h3 className={style.title}>{title}</h3>
        {headEnd}
      </div>

      {rows.length === 0 ? (
        <p className={style.emptyText}>{emptyMessage}</p>
      ) : (
        <div ref={scrollerRef} className={style.scroll}>
          <table className={style.table}>
            <tbody className={style.body}>
              {rows.map((row, index) => {
                const selected = isSelected(row, index);
                const activeTab = selected ? moveTab : null;
                const onSelectTab = (tab: MoveTab) => onSelectRow(row, index, tab);
                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelectRow(row, index)}
                    // Keyboard access: Tab reaches each row, Enter or Space
                    // selects it, exactly as a click does. Only for keys on
                    // the row itself, so Space on the row's checkbox still
                    // ticks it.
                    tabIndex={0}
                    aria-current={selected ? "true" : undefined}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectRow(row, index);
                      }
                    }}
                    className={style.row({ isSelected: selected, columns })}
                  >
                    {columns === "match" && (
                      <td className={style.checkboxCell}>
                        <input
                          type="checkbox"
                          aria-label="Tick this decision"
                          checked={isChecked?.(row) ?? false}
                          onChange={() => onToggleCheck?.(row)}
                        />
                      </td>
                    )}
                    {columns === "replay" && <td className={style.indexCell(selected)}>{index + 1}</td>}
                    {columns !== "plain" && (
                      <td className={style.diceCell}>
                        {/* Cube rows have no dice (a cube decision comes
                            before the roll); like Galaxy's own lists they
                            get a square with the cube value instead —
                            lib/cubeState.ts's cubeListValue. */}
                        {row.kind === "cube" && row.cubeSquareValue != null ? (
                          <span
                            role="img"
                            aria-label={`Cube ${row.cubeSquareValue}`}
                            title={`Cube ${row.cubeSquareValue}`}
                            className={style.cubeSquare(row.severity)}
                          >
                            {row.cubeSquareValue}
                          </span>
                        ) : row.roll.length > 0 ? (
                          <DiceRoll roll={row.roll} />
                        ) : (
                          rollEmptyPlaceholder
                        )}
                      </td>
                    )}
                    <td className={style.moveCell}>
                      <MoveDelta decision={row} activeTab={activeTab} onSelectTab={onSelectTab} />
                    </td>
                    <td className={style.trailingCell}>
                      {/* First in the right-hand cell, so it never shifts
                          the move. Only rendered when there's a note. */}
                      {hasNote(row) && (
                        <span title="Has a note" className={style.noteDot}>
                          <span className={style.srOnly}>has a note</span>
                        </span>
                      )}
                      {renderTrailing?.(row)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
