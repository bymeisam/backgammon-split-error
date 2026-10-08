// Page-local (see .claude/skills/styling-conventions) — covers Home and the
// dashboard widgets defined in the same page.tsx (DueCardsWidget,
// RatingWidget, WeeklyMistakesWidget, LatestMatchesWidget, Widget,
// WidgetFallback). The page container/title are PageShell's.
export const style = {
  // The small widgets in a row (one column on narrow screens).
  widgetGrid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  widget: "flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900",
  widgetTitle: "text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
  bigNumber: "font-mono text-3xl font-semibold text-black dark:text-zinc-50",
  widgetNote: "text-xs text-zinc-500 dark:text-zinc-400",
  widgetLink: "text-sm text-zinc-600 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100",
  errorText: "text-sm text-red-600 dark:text-red-400",
  mutedText: "text-sm text-zinc-500 dark:text-zinc-400",

  // This week's mistakes: a small checker/cube × error/blunder grid.
  miniTable: "w-full text-sm",
  miniHeadCell: "pb-1 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400",
  miniHeadCellLeft: "pb-1 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400",
  miniLabelCell: "py-0.5 text-zinc-600 dark:text-zinc-400",
  miniNumberCell: "py-0.5 text-right font-mono text-black dark:text-zinc-100",
  miniTotalRow: "border-t border-black/10 font-semibold dark:border-white/15",

  // Latest matches: same table look as /matches.
  tableWrapper: "overflow-x-auto rounded-lg border border-black/10 dark:border-white/15",
  table: "w-full border-collapse text-left text-sm",
  tableHeadRow:
    "border-b border-black/10 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400",
  tableHeadCell: "px-3 py-2",
  tableRow: "border-b border-black/5 last:border-b-0 dark:border-white/10",
  tableCell: "px-3 py-2 font-mono text-xs text-black dark:text-zinc-100",
  opponentCell: "px-3 py-2 text-black dark:text-zinc-100",
  matchLink: "underline-offset-4 hover:underline",
  sectionHeader: "flex flex-wrap items-baseline justify-between gap-3",
  sectionTitle: "text-lg font-semibold text-black dark:text-zinc-50",
  section: "flex flex-col gap-3",
} as const;
