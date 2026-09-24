"use client";

import { useState } from "react";
import Link from "next/link";
import BoardPanel from "./BoardPanel";
import type { Decision } from "@/lib/mistakes";

// Standalone per-decision card for app/mistakes — wraps BoardPanel (reused
// exactly as-is) with the my-move/best-move toggle state BoardPanel needs,
// plus the row-level context (classification, severity, error size, link
// back to the match) BoardPanel itself doesn't render.
export default function DecisionCard({
  decision,
  classification,
  matchHref,
}: {
  decision: Decision;
  classification: string;
  matchHref: string;
}) {
  const [moveTab, setMoveTab] = useState<"my" | "best">("my");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-black/10 bg-zinc-50 px-2.5 py-1 font-mono text-zinc-700 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-300">
            {classification}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 font-mono ${
              decision.severity === "blunder"
                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                : decision.severity === "error"
                  ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : "border-black/10 bg-zinc-50 text-zinc-500 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {decision.severity ?? "none"}
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">
            |error| {decision.absError.toFixed(3)}
          </span>
        </div>
        <Link
          href={matchHref}
          className="text-zinc-500 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          View match →
        </Link>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMoveTab("my")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            moveTab === "my"
              ? "border-black/20 bg-zinc-100 text-black dark:border-white/25 dark:bg-zinc-800 dark:text-zinc-50"
              : "border-black/10 text-zinc-500 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          My move
        </button>
        <button
          type="button"
          onClick={() => setMoveTab("best")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            moveTab === "best"
              ? "border-black/20 bg-zinc-100 text-black dark:border-white/25 dark:bg-zinc-800 dark:text-zinc-50"
              : "border-black/10 text-zinc-500 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          Best move
        </button>
      </div>

      <BoardPanel selected={decision} moveTab={moveTab} />
    </div>
  );
}
