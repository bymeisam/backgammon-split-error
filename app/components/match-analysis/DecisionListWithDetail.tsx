"use client";

import { resolveSelected } from "@/lib/listSelection";
import { useListSelection } from "@/app/hooks/useListSelection";
import DecisionCard from "./DecisionCard";
import { MoveDelta } from "./MistakesSection";
import SeverityBadge from "@/app/components/ui/SeverityBadge";
import ClassificationBadge from "@/app/components/ui/ClassificationBadge";
import type { severityBadges, classificationBadges } from "@/lib/badges";
import type { Decision } from "@/lib/mistakes";
import { style } from "./DecisionListWithDetail.styles";

export interface DecisionListItem {
  decision: Decision;
  classification: string;
  matchHref: string;
}

// List + single-detail split, matching the exact pattern MistakesSection.tsx
// already uses on /matches/[matchId] and /galaxy/matches/[matchId]:
// client-side useState selection (not a sub-route), defaulting to the first
// item, board panel and list laid out side-by-side via lg:flex-row. The
// list row itself reuses MistakesSection's own MoveDelta component/styling
// directly (color-coded my-move/best-move notation, red for blunder/amber
// otherwise, green for best — matching its exact existing convention),
// plus a compact SeverityBadge inline with it and (only when no
// classification filter is applied) a ClassificationBadge — the match link
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
        <div className={style.listScroll}>
          <table className={style.listTable}>
            <thead>
              <tr className={style.listHeadRow}>
                <th className={style.tableCell}>Detail</th>
                <th className={style.tableCell}>|Error|</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isSelected = item.decision.id === (selected?.decision.id ?? null);
                return (
                  <tr
                    key={item.decision.id}
                    onClick={() => selectRow(item.decision.id)}
                    className={style.listRow(isSelected)}
                  >
                    <td className={style.listDetailCell}>
                      <span className={style.listBadgeGroup}>
                        {item.decision.severity && (
                          <SeverityBadge type={item.decision.severity as keyof typeof severityBadges} />
                        )}
                        {showClassification && (
                          <ClassificationBadge
                            type={item.classification as keyof typeof classificationBadges}
                          />
                        )}
                        <MoveDelta
                          decision={item.decision}
                          activeTab={isSelected ? moveTab : null}
                          onSelectTab={(tab) => selectRow(item.decision.id, tab)}
                        />
                      </span>
                    </td>
                    <td className={style.listErrorCell}>
                      {item.decision.absError.toFixed(3)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
