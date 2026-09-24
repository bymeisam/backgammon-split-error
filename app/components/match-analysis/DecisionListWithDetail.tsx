"use client";

import { useState } from "react";
import DecisionCard from "./DecisionCard";
import { MoveDelta } from "./MistakesSection";
import type { Decision } from "@/lib/mistakes";

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
// otherwise, green for best — matching its exact existing convention) —
// classification, severity badge, and the match link deliberately don't
// appear here; that context lives only in the single selected DecisionCard,
// not duplicated per row. Only the *selected* decision ever gets a
// BoardPanel/board SVG rendered.
export default function DecisionListWithDetail({ items }: { items: DecisionListItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moveTab, setMoveTab] = useState<"my" | "best">("my");
  const selected = items.find((i) => i.decision.id === selectedId) ?? items[0] ?? null;

  function selectRow(id: string, tab: "my" | "best" = "my") {
    setSelectedId(id);
    setMoveTab(tab);
  }

  if (items.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No decisions match this filter.</p>;
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex-1 lg:min-w-0">
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

      <div className="flex w-full flex-col gap-2 lg:max-h-[80vh] lg:w-[380px] lg:shrink-0 lg:overflow-y-auto">
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400">
                <th className="px-3 py-2">Detail</th>
                <th className="px-3 py-2">|Error|</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isSelected = item.decision.id === (selected?.decision.id ?? null);
                return (
                  <tr
                    key={item.decision.id}
                    onClick={() => selectRow(item.decision.id)}
                    className={`cursor-pointer border-b border-black/5 last:border-b-0 dark:border-white/10 ${
                      isSelected
                        ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/40 dark:ring-blue-500"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      <MoveDelta
                        decision={item.decision}
                        activeTab={isSelected ? moveTab : null}
                        onSelectTab={(tab) => selectRow(item.decision.id, tab)}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-black dark:text-zinc-100">
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
