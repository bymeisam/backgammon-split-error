import clsx from "clsx";
import type { Severity } from "@/lib/mistakes";
import { playedMoveTier } from "@/lib/badges";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers MoveDelta.tsx, the move cell of every list row (DecisionList).
// Severity colours come from the one source, lib/styles/shared.styles.ts's
// severityText (the *-ink tokens, readable as text in both modes).
export const style = {
  wrapper: "block min-w-0",

  // Function, 2 params -> passed directly. The played move: plain ink when
  // it was the best play, otherwise its severity's ink (lib/badges.ts's
  // playedMoveTier). The active tab is underlined.
  myLabel: (severity: Severity | null, isActive: boolean): string =>
    clsx(
      "cursor-pointer break-words font-mono text-[13px] font-medium leading-[1.3] underline-offset-4",
      playedMoveTier(severity) === "best" ? "text-ink" : shared.severityText(playedMoveTier(severity)),
      isActive ? "underline" : "hover:underline"
    ),

  // Function, 1 param -> passed directly. "best 13/11 6/5" under the
  // played move.
  bestLabel: (isActive: boolean): string =>
    clsx(
      "mt-0.5 block cursor-pointer font-mono text-[11.5px] leading-[1.3] text-ink-faint underline-offset-4",
      isActive ? "underline" : "hover:underline"
    ),
  bestMove: "font-medium text-best-ink",

  // The opponent's half of a Double/Too good best action ("opponent should
  // take"), small after the best move.
  bestDetail: "ml-1 font-sans text-[10.5px] text-ink-faint",

  // Function, 1 param -> passed directly. The single label shown when the
  // played move was the best one: plain ink.
  collapsedLabel: (isActive: boolean): string =>
    clsx(
      "cursor-pointer break-words font-mono text-[13px] font-medium leading-[1.3] text-ink underline-offset-4",
      isActive ? "underline" : "hover:underline"
    ),
} as const;
