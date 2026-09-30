import clsx from "clsx";

// Page-local (see .claude/skills/styling-conventions) — covers
// page.tsx and GameReplay.tsx, the only components in this route folder.
export const style = {
  pageContainer: "flex flex-1 justify-center bg-zinc-50 dark:bg-black",
  main: "flex w-full max-w-7xl flex-col gap-6 px-6 py-12",

  headerBlock: "flex w-full flex-wrap items-baseline justify-between gap-2",
  title: "text-2xl font-semibold tracking-tight text-black dark:text-zinc-50",
  backLink:
    "text-sm text-zinc-500 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100",
  notFoundBox:
    "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-600 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400",

  // GameReplay.tsx's own markup — same board+list split shape as
  // DecisionListWithDetail.styles.ts's layout/cardColumn/listWrapper.
  layout: "flex flex-col gap-6 lg:flex-row lg:items-start",
  boardColumn: "flex flex-1 flex-col gap-3 lg:min-w-0",
  emptyState: "text-sm text-zinc-500 dark:text-zinc-400",

  navRow: "flex items-center justify-between gap-3",
  // Shared by Previous/Next — identical static string, same
  // disabled:opacity-40-driven look as app/matches/matches.styles.ts's own
  // paginationButton.
  navButton:
    "inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-black transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
  positionCounter: "text-sm text-zinc-600 dark:text-zinc-400",

  gameBoundaryRow: "flex justify-center",
  gameBoundaryLink:
    "text-sm font-medium text-zinc-600 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100",

  listWrapper:
    "flex w-full flex-col gap-2 lg:max-h-[80vh] lg:w-[380px] lg:shrink-0 lg:overflow-y-auto",
  listScroll: "overflow-x-auto rounded-lg border border-black/10 dark:border-white/15",
  listTable: "w-full border-collapse text-left text-sm",
  listHeadRow:
    "border-b border-black/10 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400",
  // Shared by all 3 head cells (#/Roll/Detail).
  tableCell: "px-3 py-2",

  // Function, 1 param -> passed directly.
  listRow: (isSelected: boolean): string =>
    clsx(
      "cursor-pointer border-b border-black/5 last:border-b-0 dark:border-white/10",
      isSelected
        ? "bg-blue-50 ring-1 ring-inset ring-blue-400 dark:bg-blue-950/40 dark:ring-blue-500"
        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
    ),

  indexCell: "px-3 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400",
  rollCell: "px-3 py-2",
  listDetailCell: "px-3 py-2 font-mono text-xs",
} as const;
