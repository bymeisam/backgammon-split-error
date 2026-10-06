"use client";

import Link from "next/link";
import BoardPanel from "./BoardPanel";
import SeverityBadge from "@/app/components/ui/SeverityBadge";
import ClassificationBadge from "@/app/components/ui/ClassificationBadge";
import type { Decision } from "@/lib/mistakes";
import { style } from "./DecisionListWithDetail.styles";

// The board-detail panel for app/mistakes's selected decision — wraps
// BoardPanel plus the context (classification, severity, error size, link
// back to the match) BoardPanel itself doesn't render. No my-move/best-move
// toggle of its own: the tab is switched from the list rows' MoveDelta
// labels or BoardPanel's own move boxes (via onSelectTab). moveTab is a
// controlled prop, not internal state, so every input stays in sync. Only
// ever rendered once (for the current selection), never per list row.
export default function DecisionCard({
  decision,
  classification,
  matchHref,
  moveTab,
  onMoveTabChange,
  canEditNotes,
}: {
  decision: Decision;
  classification: string;
  matchHref: string;
  moveTab: "my" | "best";
  onMoveTabChange: (tab: "my" | "best") => void;
  canEditNotes: boolean;
}) {
  return (
    <div data-testid="decision-card" className={style.card}>
      <div className={style.cardHeader}>
        <div className={style.cardBadgeGroup}>
          <ClassificationBadge type={classification} />
          <SeverityBadge type={decision.severity ?? "none"} />
          <span className={style.cardErrorText}>
            |error| {decision.absError.toFixed(3)}
          </span>
        </div>
        <Link href={matchHref} className={style.cardMatchLink}>
          View match →
        </Link>
      </div>

      <BoardPanel
        selected={decision}
        moveTab={moveTab}
        onSelectTab={onMoveTabChange}
        canEditNotes={canEditNotes}
      />
    </div>
  );
}
