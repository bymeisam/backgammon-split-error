import clsx from "clsx";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers DecisionListWithDetail.tsx and its exclusive subcomponent
// DecisionCard.tsx (used only by DecisionListWithDetail, same folder, per
// the same "folds into one file" reasoning Board.tsx's own
// BoardPanel.styles.ts already established).
export const style = {
  // DecisionListWithDetail's own markup.
  emptyStateText: "text-sm text-zinc-500 dark:text-zinc-400",
  layout: "flex flex-col gap-6 lg:flex-row lg:items-start",
  cardColumn: "flex-1 lg:min-w-0",
  listWrapper:
    "flex w-full flex-col gap-2 lg:max-h-[80vh] lg:w-[380px] lg:shrink-0 lg:overflow-y-auto",
  listScroll: "overflow-x-auto rounded-lg border border-black/10 dark:border-white/15",
  listTable: "w-full border-collapse text-left text-sm",
  listHeadRow:
    "border-b border-black/10 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400",
  // Shared by both head cells (Detail/|Error|) — plain padding, nothing else.
  tableCell: "px-3 py-2",

  // Function, 1 param -> passed directly.
  listRow: (isSelected: boolean): string =>
    clsx(
      "cursor-pointer border-b border-black/5 last:border-b-0 dark:border-white/10",
      isSelected
        ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/40 dark:ring-blue-500"
        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
    ),

  listDetailCell: "px-3 py-2 font-mono text-xs",
  listBadgeGroup: "inline-flex items-center gap-1.5",
  listErrorCell: "px-3 py-2 font-mono text-xs text-black dark:text-zinc-100",

  // DecisionCard.tsx's own markup.
  card: "flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900",
  cardHeader: "flex flex-wrap items-center justify-between gap-2 text-xs",
  cardBadgeGroup: "flex flex-wrap items-center gap-2",
  cardErrorText: "text-zinc-500 dark:text-zinc-400",
  cardMatchLink:
    "text-zinc-500 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100",
} as const;
