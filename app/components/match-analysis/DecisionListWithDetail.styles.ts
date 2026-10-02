// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers DecisionListWithDetail.tsx and its exclusive subcomponent
// DecisionCard.tsx (used only by DecisionListWithDetail, same folder, per
// the same "folds into one file" reasoning Board.tsx's own
// BoardPanel.styles.ts already established). The list's own row/table
// markup moved into DecisionList.styles.ts as part of the 2026-10-03
// consolidation of the three decision-list implementations —
// listBadgeGroup stays here since it wraps DecisionListWithDetail's own
// renderDetailCell content (severity/classification badges + MoveDelta),
// not something DecisionList itself renders.
export const style = {
  // DecisionListWithDetail's own markup.
  emptyStateText: "text-sm text-zinc-500 dark:text-zinc-400",
  layout: "flex flex-col gap-6 lg:flex-row lg:items-start",
  cardColumn: "flex-1 lg:min-w-0",
  listWrapper:
    "flex w-full flex-col gap-2 lg:max-h-[80vh] lg:w-[380px] lg:shrink-0 lg:overflow-y-auto",
  listBadgeGroup: "inline-flex items-center gap-1.5",

  // DecisionCard.tsx's own markup.
  card: "flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900",
  cardHeader: "flex flex-wrap items-center justify-between gap-2 text-xs",
  cardBadgeGroup: "flex flex-wrap items-center gap-2",
  cardErrorText: "text-zinc-500 dark:text-zinc-400",
  cardMatchLink:
    "text-zinc-500 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100",
} as const;
