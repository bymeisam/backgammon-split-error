"use client";

import type { ReactNode } from "react";
import type { Decision } from "@/lib/mistakes";
import type { MoveTab } from "@/lib/listSelection";
import { DiceRoll } from "./Dice";
import MoveDelta from "./MoveDelta";
import { style } from "./DecisionList.styles";

interface DecisionListProps {
  rows: Decision[];
  // Header row above the table (MistakesSection only) — a title and/or the
  // select-all/none actions. Omitted entirely (no header rendered at all)
  // when neither is provided.
  title?: string;
  // Shown instead of the table when rows.length === 0.
  emptyMessage?: string;

  isSelected: (row: Decision, index: number) => boolean;
  moveTab: MoveTab;
  onSelectRow: (row: Decision, index: number, tab?: MoveTab) => void;

  // Column toggles — all default off; an unconfigured list shows only the
  // always-present Detail (MoveDelta) column and row-highlight behavior.
  showIndexColumn?: boolean;
  showRollColumn?: boolean;
  // DiceRoll's own size prop — MistakesSection and GameReplay use
  // different sizes (18 vs 16), so this is explicit rather than inferred
  // from any other prop.
  rollDiceSize?: number;
  // What to show in the Roll cell when a row's own roll is empty —
  // MistakesSection shows a muted "—"; GameReplay shows nothing at all
  // (matches DiceRoll's own null-for-empty behavior exactly when omitted).
  rollEmptyPlaceholder?: ReactNode;
  showErrorColumn?: boolean;

  // Checkbox column — active only when both are provided together
  // (MistakesSection's only use case). onSelectAll/onSelectNone render the
  // corresponding header-row button when provided; independent of the
  // checkbox column itself, though in practice always paired with it.
  isChecked?: (row: Decision) => boolean;
  onToggleCheck?: (row: Decision) => void;
  onSelectAll?: () => void;
  onSelectNone?: () => void;

  // Detail-cell override — default is a plain <MoveDelta>; only
  // DecisionListWithDetail overrides this, to prepend its severity/
  // classification badges before MoveDelta.
  renderDetailCell?: (
    row: Decision,
    activeTab: MoveTab | null,
    onSelectTab: (tab: MoveTab) => void
  ) => ReactNode;
}

// Shared row/table rendering for MistakesSection's two tables (checker/cube
// mistakes), DecisionListWithDetail's list (/mistakes, /repeated-
// positions), and GameReplay's list (replay) — consolidated from three
// independently-written but mostly-identical implementations (see
// PROGRESS.md's entry for the exact confirmed differences this preserves).
// Deliberately NOT responsible for selection/tick state: each caller keeps
// its own useListSelection/useTickSet (their key types differ — two
// callers select by Decision.id, GameReplay by array index) and passes
// plain callbacks down instead, rather than this component reconciling two
// incompatible key types internally.
export default function DecisionList({
  rows,
  title,
  emptyMessage,
  isSelected,
  moveTab,
  onSelectRow,
  showIndexColumn = false,
  showRollColumn = false,
  rollDiceSize = 18,
  rollEmptyPlaceholder,
  showErrorColumn = false,
  isChecked,
  onToggleCheck,
  onSelectAll,
  onSelectNone,
  renderDetailCell,
}: DecisionListProps) {
  const showCheckboxColumn = isChecked !== undefined && onToggleCheck !== undefined;

  return (
    <div className={style.wrapper}>
      {(title || onSelectAll || onSelectNone) && (
        <div className={style.header}>
          {title && <h3 className={style.title}>{title}</h3>}
          {(onSelectAll || onSelectNone) && (
            <div className={style.actions}>
              {onSelectAll && (
                <button type="button" onClick={onSelectAll} className={style.actionButton}>
                  Select all
                </button>
              )}
              {onSelectNone && (
                <button type="button" onClick={onSelectNone} className={style.actionButton}>
                  Select none
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className={style.emptyText}>{emptyMessage}</p>
      ) : (
        <div className={style.scroll}>
          <table className={style.table}>
            <thead>
              <tr className={style.headRow}>
                {showCheckboxColumn && <th className={style.checkboxHeadCell}></th>}
                {showIndexColumn && <th className={style.cell}>#</th>}
                {showRollColumn && <th className={style.cell}>Roll</th>}
                <th className={style.cell}>Detail</th>
                {showErrorColumn && <th className={style.cell}>|Error|</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const selected = isSelected(row, index);
                const activeTab = selected ? moveTab : null;
                const onSelectTab = (tab: MoveTab) => onSelectRow(row, index, tab);
                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelectRow(row, index)}
                    className={style.row(selected)}
                  >
                    {showCheckboxColumn && (
                      <td className={style.cell}>
                        <input
                          type="checkbox"
                          checked={isChecked!(row)}
                          onChange={() => onToggleCheck!(row)}
                        />
                      </td>
                    )}
                    {showIndexColumn && <td className={style.indexCell}>{index + 1}</td>}
                    {showRollColumn && (
                      <td className={style.cell}>
                        {row.roll.length > 0 ? (
                          <DiceRoll roll={row.roll} size={rollDiceSize} />
                        ) : (
                          rollEmptyPlaceholder
                        )}
                      </td>
                    )}
                    <td className={style.detailCell}>
                      {renderDetailCell ? (
                        renderDetailCell(row, activeTab, onSelectTab)
                      ) : (
                        <MoveDelta decision={row} activeTab={activeTab} onSelectTab={onSelectTab} />
                      )}
                    </td>
                    {showErrorColumn && (
                      <td className={style.errorCell}>{row.absError.toFixed(3)}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
