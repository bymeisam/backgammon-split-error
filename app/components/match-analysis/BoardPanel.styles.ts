import clsx from "clsx";
import type { Severity } from "@/lib/mistakes";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// used by /matches/[matchId], /galaxy/matches/[matchId] (via
// MistakesSection.tsx), /mistakes and /repeated-positions (via
// DecisionCard.tsx), and the game replay (GameReplay.tsx). Covers both
// BoardPanel.tsx and Board.tsx, its own subcomponent (exclusively used by
// BoardPanel, same folder). Dice.tsx is NOT covered here — it's also used
// independently by MistakesSection.tsx, so it isn't exclusively
// BoardPanel's subcomponent and gets its own Dice.styles.ts instead.
export const style = {
  panelStack: "flex flex-col gap-3",
  panel:
    "flex flex-col items-center gap-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900",
  emptyState: "text-sm text-zinc-500 dark:text-zinc-400",
  infoRow: "flex flex-wrap items-stretch justify-center gap-2 text-xs",
  gameBadge:
    "flex items-center gap-1 rounded-lg border border-black/10 bg-zinc-50 px-3 py-1.5 dark:border-white/15 dark:bg-zinc-800",
  gameBadgeLabel: "text-zinc-500 dark:text-zinc-400",
  gameBadgeValue: "font-semibold text-black dark:text-zinc-50",
  moveNotation: "font-mono font-semibold",
  // Shared by the error-magnitude text ("(0.028)") and the static "My
  // move"/"Best move" labels — all the same de-emphasized-text treatment.
  mutedLabel: "opacity-70",
  bestMoveStatic:
    "flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",

  // Function, 3+ params -> single options object. Shared by both the
  // clickable-button variant (onSelectTab provided) and the static-div
  // variant (not provided) for the my-move box, differing only in
  // interactivity (button vs div) and the active-state ring.
  myMoveBadge: (opts: { severity: Severity | null; isActive: boolean }): string =>
    clsx(
      "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors",
      opts.severity === "blunder"
        ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
      opts.isActive
        ? "ring-1 ring-inset ring-black/30 dark:ring-white/40"
        : "opacity-70 hover:opacity-100"
    ),

  // Function, 1 param -> passed directly. The green best-move box (the
  // clickable variant).
  bestMoveButton: (isActive: boolean): string =>
    clsx(
      "flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-green-700 transition-colors dark:border-green-800 dark:bg-green-950 dark:text-green-300",
      isActive ? "ring-1 ring-inset ring-black/30 dark:ring-white/40" : "opacity-70 hover:opacity-100"
    ),
  // The opponent's half of a Double/Too good best action ("opponent should
  // take"), small and grey after the label.
  bestDetail: "text-[10px] text-zinc-500 dark:text-zinc-400",

  // Function, 1 param -> passed directly. The static (non-interactive)
  // my-move box variant, used when onSelectTab isn't provided.
  myMoveStatic: (severity: Severity | null): string =>
    clsx(
      "flex items-center gap-1.5 rounded-lg border px-3 py-1.5",
      severity === "blunder"
        ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
    ),

  // Board.tsx's own two classes.
  boardSvg: "w-full",
  diceWrapper: "flex h-full w-full items-center justify-center",
} as const;
