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
  externalMatchHref,
  moveTab,
  onMoveTabChange,
  canEditNotes,
}: {
  decision: Decision;
  classification: string;
  matchHref: string;
  // "View on Galaxy" (lib/externalMatchUrl.ts) — null for a non-Galaxy
  // match, which gets no link.
  externalMatchHref: string | null;
  moveTab: "my" | "best";
  onMoveTabChange: (tab: "my" | "best") => void;
  canEditNotes: boolean;
}) {
  return (
    <div data-testid="decision-card" className={style.card}>
      <div className={style.cardHeader}>
        <div className={style.cardBadgeGroup}>
          <ClassificationBadge type={classification} />
          <SeverityBadge type={decision.severity ?? "best"} />
          <span className={style.cardErrorText}>
            |error| {decision.absError.toFixed(3)}
          </span>
        </div>
        <div className={style.cardLinkGroup}>
          <Link href={matchHref} className={style.cardMatchLink}>
            View match →
          </Link>
          {externalMatchHref && (
            <a
              href={externalMatchHref}
              target="_blank"
              rel="noopener noreferrer"
              className={style.cardMatchLink}
            >
              View on Galaxy ↗
            </a>
          )}
        </div>
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
