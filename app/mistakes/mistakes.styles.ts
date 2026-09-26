import clsx from "clsx";

// Page-local (see .claude/skills/styling-conventions) — covers
// MistakesPage and every component defined in this same page.tsx file
// (FilterSelect, FilterSelects, FilterSelectsFallback, DecisionListSection,
// DecisionListFallback).
export const style = {
  pageContainer: "flex flex-1 justify-center bg-zinc-50 dark:bg-black",
  main: "flex w-full max-w-7xl flex-col gap-6 px-6 py-12",
  title: "text-2xl font-semibold tracking-tight text-black dark:text-zinc-50",
  subtitle: "mt-1 text-sm text-zinc-600 dark:text-zinc-400",
  backLink: "underline hover:text-black dark:hover:text-zinc-100",
  form: "flex flex-wrap items-end gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-zinc-900",
  filterLabel: "flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400",
  filterSelect:
    "rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm text-black dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-100",
  filterSelectDisabled:
    "rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm text-zinc-400 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-500",
  applyButton:
    "rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-black hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
  noFilterText: "text-sm text-zinc-500 dark:text-zinc-400",
  // Shared by the result-count line and the "Page N of M" indicator — same
  // muted-text treatment.
  mutedText: "text-sm text-zinc-600 dark:text-zinc-400",
  paginationRow: "flex items-center justify-between",
  fallbackRow: "flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400",
  fallbackSpinner:
    "h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300",

  // Function, 1 param -> passed directly. Shared by both the Prev and Next
  // pagination links, differing only in which boolean disables them.
  paginationLink: (isDisabled: boolean): string =>
    clsx(
      "inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-black dark:border-white/15 dark:text-zinc-100",
      isDisabled ? "pointer-events-none opacity-40" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
    ),
} as const;
