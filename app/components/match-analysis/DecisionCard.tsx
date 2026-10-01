"use client";

import Link from "next/link";
import BoardPanel from "./BoardPanel";
import SeverityBadge from "@/app/components/ui/SeverityBadge";
import ClassificationBadge from "@/app/components/ui/ClassificationBadge";
import type { Decision } from "@/lib/mistakes";
import { style } from "./DecisionListWithDetail.styles";

// The board-detail panel for app/mistakes's selected decision — wraps
// BoardPanel plus the context (classification, severity, error size, link
// back to the match) BoardPanel itself doesn't render. No separate
// my-move/best-move toggle here — that was redundant with two other
// clickable places that already switch the same moveTab: the list panel's
// row labels (DecisionListWithDetail, via reused MoveDelta) and, now,
// BoardPanel's own my-move/best-move boxes below the board (passed
// onSelectTab, which BoardPanel only turns into buttons when given one —
// MistakesSection's usage elsewhere doesn't pass it, so stays unchanged).
// moveTab is a controlled prop, not internal state, so all three inputs
// stay in sync. Only ever rendered once (for the current selection), never
// per list row.
export default function DecisionCard({
  decision,
  classification,
  matchHref,
  moveTab,
  onMoveTabChange,
}: {
  decision: Decision;
  classification: string;
  matchHref: string;
  moveTab: "my" | "best";
  onMoveTabChange: (tab: "my" | "best") => void;
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

      <BoardPanel selected={decision} moveTab={moveTab} onSelectTab={onMoveTabChange} />
    </div>
  );
}
