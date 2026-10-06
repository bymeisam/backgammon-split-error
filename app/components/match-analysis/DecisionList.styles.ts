import clsx from "clsx";

// Shared by MistakesSection's two tables, DecisionListWithDetail's list,
// and GameReplay's list — these were byte-identical Tailwind strings
// across all three components' own .styles.ts files before this
// consolidation (confirmed by direct comparison), just duplicated three
// times. The outer [380px]/overflow-y-auto sizing wrapper stays
// caller-owned (MistakesSection wraps two <DecisionList>s in one shared
// scroll region; DecisionListWithDetail/GameReplay each wrap a single
// one) — not part of this component, which starts one level in.
export const style = {
  wrapper: "flex flex-col gap-2",
  header: "flex items-center justify-between",
  title: "text-sm font-semibold text-black dark:text-zinc-50",
  actions: "flex gap-2 text-xs",
  // Shared by both "Select all" and "Select none".
  actionButton:
    "text-zinc-600 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100",
  emptyText: "text-sm text-zinc-500 dark:text-zinc-400",
  scroll: "overflow-x-auto rounded-lg border border-black/10 dark:border-white/15",
  table: "w-full border-collapse text-left text-sm",
  headRow:
    "border-b border-black/10 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400",
  checkboxHeadCell: "w-8 px-3 py-2",
  // Generic cell padding — head cells, the checkbox/roll body cells.
  cell: "px-3 py-2",
  detailCell: "px-3 py-2 font-mono text-xs",
  errorCell: "px-3 py-2 font-mono text-xs text-black dark:text-zinc-100",
  indexCell: "px-3 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400",
  // "Has note" marker, inline before the detail cell's own content.
  noteDot: "mr-1.5 inline-block h-2 w-2 rounded-full bg-blue-500 align-middle dark:bg-blue-400",

  // Function, 1 param -> passed directly.
  row: (isSelected: boolean): string =>
    clsx(
      "cursor-pointer border-b border-black/5 last:border-b-0 dark:border-white/10",
      isSelected
        ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/40 dark:ring-blue-500"
        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
    ),
} as const;
