"use client";

import { useMemo } from "react";
import { resolveSelected } from "@/lib/listSelection";
import { useListSelection } from "@/app/hooks/useListSelection";
import DecisionCard from "./DecisionCard";
import DecisionList from "./DecisionList";
import MoveDelta from "./MoveDelta";
import SeverityBadge from "@/app/components/ui/SeverityBadge";
import ClassificationBadge from "@/app/components/ui/ClassificationBadge";
import type { DecisionListItem } from "@/lib/decisionFromRow";
import { style } from "./DecisionListWithDetail.styles";

// List + single-detail split for /mistakes and /repeated-positions, same
// pattern as MistakesSection on the match pages: client-side selection
// (useListSelection, not a sub-route), defaulting to the first item, board
// panel and list side by side via lg:flex-row. Each row shows MoveDelta's
// color-coded my-move/best-move notation, a compact SeverityBadge and
// (only when no classification filter is applied) a ClassificationBadge — the match link
// deliberately doesn't appear here; that lives only in the single selected
// DecisionCard, not duplicated per row. Only the *selected* decision ever
// gets a BoardPanel/board SVG rendered.
export default function DecisionListWithDetail({
  items,
  showClassification,
}: {
  items: DecisionListItem[];
  showClassification: boolean;
}) {
  const { selectedKey: selectedId, moveTab, selectRow, setMoveTab } =
    useListSelection<string | null>(null);
  const selected = resolveSelected(items, selectedId, (i) => i.decision.id);

  // DecisionList's renderDetailCell receives only the plain Decision row
  // (shared across all three callers), not this component's own
  // DecisionListItem wrapper — so the classification each row needs for
  // its optional badge is looked up from this map instead of threaded
  // through DecisionList itself, keeping that component ignorant of this
  // caller-specific wrapper shape.
  const classificationByDecisionId = useMemo(
    () => new Map(items.map((item) => [item.decision.id, item.classification])),
    [items]
  );

  if (items.length === 0) {
    return <p className={style.emptyStateText}>No decisions match this filter.</p>;
  }

  return (
    <div className={style.layout}>
      <div className={style.cardColumn}>
        {selected && (
          <DecisionCard
            key={selected.decision.id}
            decision={selected.decision}
            classification={selected.classification}
            matchHref={selected.matchHref}
            moveTab={moveTab}
            onMoveTabChange={setMoveTab}
          />
        )}
      </div>

      <div data-testid="mistake-row-list" className={style.listWrapper}>
        <DecisionList
          rows={items.map((item) => item.decision)}
          isSelected={(row) => row.id === (selected?.decision.id ?? null)}
          moveTab={moveTab}
          onSelectRow={(row, _index, tab) => selectRow(row.id, tab)}
          showErrorColumn
          renderDetailCell={(row, activeTab, onSelectTab) => (
            <span className={style.listBadgeGroup}>
              {row.severity && <SeverityBadge type={row.severity} />}
              {showClassification && (
                <ClassificationBadge type={classificationByDecisionId.get(row.id) ?? ""} />
              )}
              <MoveDelta decision={row} activeTab={activeTab} onSelectTab={onSelectTab} />
            </span>
          )}
        />
      </div>
    </div>
  );
}
