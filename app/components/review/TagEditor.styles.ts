import clsx from "clsx";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers TagEditor.tsx, used by DecisionReviewTools (below the board on
// /mistakes, /repeated-positions, /matches/[matchId] and the replay) and by
// the back of a /review card.
export const style = {
  wrapper: "flex flex-col gap-2",
  label: "text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
  chipRow: "flex flex-wrap items-center gap-1.5",
  chip: "inline-flex items-center gap-1 rounded-full border border-black/10 bg-zinc-100 px-2.5 py-0.5 text-xs text-black dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-100",
  chipRemove:
    "rounded-full px-1 text-zinc-500 hover:bg-zinc-200 hover:text-black disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-50",
  inputWrapper: "relative",
  input:
    "w-full rounded-lg border border-black/10 bg-zinc-50 px-3 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-white/40",
  suggestions:
    "absolute left-0 right-0 top-full z-10 mt-1 flex max-h-48 flex-col overflow-y-auto rounded-lg border border-black/10 bg-white py-1 shadow-sm dark:border-white/15 dark:bg-zinc-900",
  // Function, 1 param -> passed directly. The keyboard-highlighted
  // suggestion gets a background.
  suggestion: (isActive: boolean): string =>
    clsx(
      "px-3 py-1 text-left text-sm text-black hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800",
      isActive && "bg-zinc-100 dark:bg-zinc-800"
    ),
  error: "text-xs text-red-600 dark:text-red-400",
  emptyText: "text-xs text-zinc-500 dark:text-zinc-400",
} as const;
