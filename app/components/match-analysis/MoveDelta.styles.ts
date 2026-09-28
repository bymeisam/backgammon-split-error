import clsx from "clsx";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// MoveDelta is defined in MistakesSection.tsx but used independently by
// MistakesSection.tsx itself and by DecisionListWithDetail.tsx, so it
// isn't exclusively either one's subcomponent and gets its own file, same
// reasoning as Dice.styles.ts.
export const style = {
  wrapper: "whitespace-nowrap",

  // Function, 2 params -> passed directly. The severity->color branch used
  // to be computed separately (a `myColor` const in MoveDelta itself)
  // before being interpolated into the className template literal — moved
  // in here to match BoardPanel.styles.ts's own myMoveBadge/myMoveStatic
  // precedent for the exact same severity-based color decision.
  myLabel: (severity: "blunder" | "error" | null, isActive: boolean): string =>
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
} as const;
