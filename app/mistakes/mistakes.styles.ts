// Page-local (see .claude/skills/styling-conventions) — covers
// MistakesPage and every component defined in this same page.tsx file
// (FilterSelects, DecisionListSection, DecisionListFallback). The filter
// dropdowns and pagination row are shared components with their own styles
// (app/components/ui/FilterSelect.styles.ts, PaginationLinks.styles.ts).
export const style = {
  pageContainer: "flex flex-1 justify-center bg-zinc-50 dark:bg-black",
  main: "flex w-full max-w-7xl flex-col gap-6 px-6 py-12",
  title: "text-2xl font-semibold tracking-tight text-black dark:text-zinc-50",
  subtitle: "mt-1 text-sm text-zinc-600 dark:text-zinc-400",
  backLink: "underline hover:text-black dark:hover:text-zinc-100",
  form: "flex flex-wrap items-end gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-zinc-900",
  applyButton:
    "rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-black hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
  noFilterText: "text-sm text-zinc-500 dark:text-zinc-400",
  mutedText: "text-sm text-zinc-600 dark:text-zinc-400",
  fallbackRow: "flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400",
  fallbackSpinner:
    "h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300",
} as const;
