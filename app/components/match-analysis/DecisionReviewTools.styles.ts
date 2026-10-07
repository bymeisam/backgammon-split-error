// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers DecisionReviewTools.tsx, rendered by BoardPanel.tsx below the note
// on every DB-backed page that shows a board. Same card look as
// DecisionNote.
export const style = {
  card: "flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900",
  reviewRow: "flex flex-wrap items-center gap-2 text-sm",
  addButton:
    "rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200",
  inReview:
    "inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 underline-offset-2 hover:underline dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  error: "text-xs text-red-600 dark:text-red-400",
} as const;
