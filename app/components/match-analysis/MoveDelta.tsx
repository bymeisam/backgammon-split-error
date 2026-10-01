"use client";

import type { Decision } from "@/lib/mistakes";
import type { MoveTab } from "@/lib/listSelection";
import { style } from "./MoveDelta.styles";

// A decision's my-move / best-move labels, color-coded (red blunder / amber
// otherwise / green best). Each label is clickable when `onSelectTab` is
// given — stopping propagation so a click selects that tab rather than
// (only) the surrounding list row. Shared by MistakesSection's tables,
// DecisionListWithDetail's list and GameReplay's move list.
export default function MoveDelta({
  decision,
  activeTab,
  onSelectTab,
}: {
  decision: Decision;
  activeTab?: MoveTab | null;
  onSelectTab?: (tab: MoveTab) => void;
}) {
  return (
    <span data-testid="move-delta" className={style.wrapper}>
      <span
        className={style.myLabel(decision.severity, activeTab === "my")}
        onClick={(e) => {
          e.stopPropagation();
          onSelectTab?.("my");
        }}
      >
        {decision.myLabel}
      </span>
      <span
        className={style.bestLabel(activeTab === "best")}
        onClick={(e) => {
          e.stopPropagation();
          onSelectTab?.("best");
        }}
      >
        {decision.bestLabel}
      </span>
    </span>
  );
}
