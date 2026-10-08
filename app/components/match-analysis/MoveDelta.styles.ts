import clsx from "clsx";
import type { Severity } from "@/lib/mistakes";
import { playedMoveTier } from "@/lib/badges";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers MoveDelta.tsx, used independently by MistakesSection.tsx,
// DecisionListWithDetail.tsx and GameReplay.tsx. Severity colours come from
// the one source, lib/styles/shared.styles.ts's severityText (the *-ink
// tokens, readable as text in both modes).
export const style = {
  // The played and best labels each stay on one line, but the best one can
  // wrap below the played one in a narrow list.
  wrapper: "inline",

  // Function, 2 params -> passed directly. The played move, in its
  // severity's colour (lib/badges.ts's playedMoveTier).
  myLabel: (severity: Severity | null, isActive: boolean): string =>
    clsx(
      "cursor-pointer whitespace-nowrap font-medium underline-offset-4",
      shared.severityText(playedMoveTier(severity)),
      isActive ? "underline" : "hover:underline"
    ),

  // Function, 1 param -> passed directly. The best move, always in Best's
  // colour — only the active-tab underline varies.
  bestLabel: (isActive: boolean): string =>
    clsx(
      "ml-1.5 inline-block cursor-pointer whitespace-nowrap font-medium underline-offset-4",
      shared.severityText("best"),
      isActive ? "underline" : "hover:underline"
    ),

  // The opponent's half of a Double/Too good best action ("opponent should
  // take"), small after bestLabel.
  bestDetail: "ml-1 font-sans text-[10.5px] text-ink-faint",

  // Function, 1 param -> passed directly. The single label shown when the
  // played move was the best one.
  collapsedLabel: (isActive: boolean): string =>
    clsx(
      "cursor-pointer whitespace-nowrap font-medium underline-offset-4",
      shared.severityText("best"),
      isActive ? "underline" : "hover:underline"
    ),
} as const;
