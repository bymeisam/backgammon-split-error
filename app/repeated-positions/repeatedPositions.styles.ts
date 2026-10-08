// Page-local (see .claude/skills/styling-conventions) — covers
// RepeatedPositionsPage and every component defined in this same
// page.tsx file (FilterSelects, PositionListSection, PositionListFallback,
// PositionDetailSection). Same page shell as app/mistakes/mistakes.styles.ts;
// the filter dropdowns and pagination row are shared components with their
// own styles (app/components/ui/FilterSelect.styles.ts,
// PaginationLinks.styles.ts).
// The page container, width and title are PageShell's.
export const style = {
  backLink: "underline hover:text-black dark:hover:text-zinc-100",
  form: "flex flex-wrap items-end gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-zinc-900",
  applyButton:
    "rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-black hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
  noFilterText: "text-sm text-zinc-500 dark:text-zinc-400",
  mutedText: "text-sm text-zinc-600 dark:text-zinc-400",
  fallbackRow: "flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400",
  fallbackSpinner:
    "h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300",

  positionTable: "overflow-x-auto rounded-lg border border-black/10 dark:border-white/15",
  positionTableInner: "w-full border-collapse text-left text-sm",
  positionTableHead:
    "border-b border-black/10 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400",
  positionTableHeadCell: "px-3 py-2",
  positionRow: "border-b border-black/5 last:border-b-0 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-800/60",
  positionCell: "px-3 py-2",
  positionBadgeCell: "px-3 py-2",
  positionIdText: "font-mono text-xs text-zinc-600 dark:text-zinc-400",
  occurrenceCount: "font-mono font-semibold text-black dark:text-zinc-100",
  viewLink: "text-zinc-500 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100",
} as const;
