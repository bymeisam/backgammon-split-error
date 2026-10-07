import clsx from "clsx";
import type { Severity } from "@/lib/mistakes";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers MoveDelta.tsx, used independently by MistakesSection.tsx,
// DecisionListWithDetail.tsx and GameReplay.tsx.
export const style = {
  wrapper: "whitespace-nowrap",

  // Function, 2 params -> passed directly. The severity->color branch used
  // to be computed separately (a `myColor` const in MoveDelta itself)
  // before being interpolated into the className template literal — moved
  // in here to match BoardPanel.styles.ts's own myMoveBadge/myMoveStatic
  // precedent for the exact same severity-based color decision.
  myLabel: (severity: Severity | null, isActive: boolean): string =>
    clsx(
      "cursor-pointer font-semibold",
      severity === "blunder" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400",
      isActive ? "underline" : "hover:underline"
    ),

  // Function, 1 param -> passed directly. Best-move label is always green,
  // regardless of severity — only the active-tab underline varies.
  bestLabel: (isActive: boolean): string =>
    clsx(
      "ml-1.5 cursor-pointer font-semibold text-green-600 dark:text-green-400",
      isActive ? "underline" : "hover:underline"
    ),

  // The opponent's half of a Double/Too good best action ("opponent should
  // take"), small and grey after bestLabel.
  bestDetail: "ml-1 font-sans text-[10px] text-zinc-500 dark:text-zinc-400",

  // Same green styling as bestLabel, minus its ml-1.5 — used instead of
  // myLabel+bestLabel together when the two would be identical (see
  // MoveDelta.tsx), where this is the only label shown, not the second of
  // a pair.
  collapsedLabel: (isActive: boolean): string =>
    clsx(
      "cursor-pointer font-semibold text-green-600 dark:text-green-400",
      isActive ? "underline" : "hover:underline"
    ),
} as const;
