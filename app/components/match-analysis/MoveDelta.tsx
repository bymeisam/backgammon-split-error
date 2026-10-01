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
  // isMistake is absError > 0 (lib/mistakes.ts) — already the project's
  // own signal for "the played move differs from the best move," computed
  // once at Decision-build time from Galaxy's own equity-error grading.
  // Reused here rather than re-deriving equality from the label text, so
  // this stays consistent with every other isMistake-driven distinction
  // (severity coloring, the mistake-table filters) instead of introducing
  // a second, possibly-divergent notion of "the same move."
  //
  // Shows myLabel, not bestLabel — confirmed against real data that the two
  // are only byte-identical for checker decisions. For cube/resignation
  // decisions myLabel/bestLabel are differently *phrased* even at zero
  // error (e.g. a real row: myLabel "resigned", bestLabel "should not
  // resign", rawError 0 — resigning happened to cost nothing in that exact
  // position despite not being the nominal best action). myLabel is the
  // one that's always an accurate description of what was actually played,
  // regardless of kind; bestLabel's imperative/contrastive phrasing
  // ("roll", "should not resign") would read oddly shown alone.
  if (!decision.isMistake) {
    // activeTab is null when this row isn't the selected one, and "my" or
    // "best" when it is (see MistakesSection/DecisionListWithDetail's own
    // `m.id === selectedId ? moveTab : null`) — since there's only one
    // label now, either tab value means "this row is selected," so both
    // read as active here, not just "best".
    return (
      <span data-testid="move-delta" className={style.wrapper}>
        <span
          className={style.collapsedLabel(activeTab != null)}
          onClick={(e) => {
            e.stopPropagation();
            onSelectTab?.("best");
          }}
        >
          {decision.myLabel}
        </span>
      </span>
    );
  }

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
