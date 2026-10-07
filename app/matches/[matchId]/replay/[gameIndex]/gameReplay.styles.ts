// Page-local (see .claude/skills/styling-conventions) — covers
// page.tsx and GameReplay.tsx, the only components in this route folder.
// GameReplay's own list/row/table markup moved into DecisionList.styles.ts
// as part of the 2026-10-03 consolidation of the three decision-list
// implementations — listWrapper (the [380px]/overflow sizing) stays here,
// since that stays caller-owned per DecisionList's own design.
export const style = {
  pageContainer: "flex flex-1 justify-center bg-zinc-50 dark:bg-black",
  main: "flex w-full max-w-7xl flex-col gap-6 px-6 py-12",

  headerBlock: "flex w-full flex-wrap items-baseline justify-between gap-2",
  title: "text-2xl font-semibold tracking-tight text-black dark:text-zinc-50",
  // "← Back to match" and "View on Galaxy", side by side.
  headerLinks: "flex flex-wrap items-baseline gap-4",
  // Shared by both header links.
  backLink:
    "text-sm text-zinc-500 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100",
  notFoundBox:
    "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-600 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400",

  // GameReplay.tsx's own markup — same board+list split shape as
  // DecisionListWithDetail.styles.ts's layout/cardColumn/listWrapper.
  layout: "flex flex-col gap-6 lg:flex-row lg:items-start",
  boardColumn: "flex flex-1 flex-col gap-3 lg:min-w-0",
  emptyState: "text-sm text-zinc-500 dark:text-zinc-400",

  perspectiveToggle:
    "flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400",

  navRow: "flex items-center justify-between gap-3",
  // Shared by Previous/Next — identical static string, same
  // disabled:opacity-40-driven look as app/matches/matches.styles.ts's own
  // paginationButton.
  navButton:
    "inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-black transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
  // "Move N of M", plus the take/pass step's double line under it.
  stepLabel: "flex flex-col items-center gap-0.5 text-center",
  positionCounter: "text-sm text-zinc-600 dark:text-zinc-400",
  doubleOfferLine: "text-xs text-zinc-500 dark:text-zinc-400",

  gameBoundaryRow: "flex justify-center",
  gameBoundaryLink:
    "text-sm font-medium text-zinc-600 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100",

  listWrapper:
    "flex w-full flex-col gap-2 lg:max-h-[80vh] lg:w-[380px] lg:shrink-0 lg:overflow-y-auto",
} as const;
