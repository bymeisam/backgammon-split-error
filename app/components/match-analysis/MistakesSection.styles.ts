// Page-local to this shared component (see .claude/skills/styling-conventions)
// — covers MistakesSection.tsx's own markup and its exclusive subcomponent
// PRCard (same file, used nowhere else). MoveDelta/Dice/DecisionList are
// shared leaves with their own styles files — MistakeTable's row/table
// markup moved into DecisionList.styles.ts as part of the 2026-10-03
// consolidation of the three decision-list implementations; only the
// Roll column's empty-state span (mistakeTableNoRollText, passed as
// DecisionList's rollEmptyPlaceholder prop) stays here, since it's a
// MistakesSection-specific choice, not shared with the other two callers.
export const style = {
  mistakeTableNoRollText: "text-xs text-zinc-400 dark:text-zinc-600",

  // MistakesSection's own top-level markup.
  sectionWrapper: "flex flex-col gap-6 border-t border-black/10 pt-8 dark:border-white/15",
  sectionTitle: "text-xl font-semibold tracking-tight text-black dark:text-zinc-50",
  // Shared by "No player data found in the fetched games." and
  // MistakeTable's own "No mistakes in this scope." — same muted-text
  // treatment, same reasoning mistakes.styles.ts's own mutedText uses.
  mutedText: "text-sm text-zinc-500 dark:text-zinc-400",

  // data-testid wrapper added in batch 0 (e2e/board-visual.spec.ts's
  // "mistakes-section" screenshot) — className exactly reproduces
  // sectionWrapper's own flex-col gap-6 so the wrapper introduces zero
  // visual change (verified via the visual suite, not just reasoned about;
  // see PROGRESS.md's batch-0 entry).
  mistakesSectionChrome: "flex flex-col gap-6",
  filtersRow: "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
  filterGroup: "flex flex-col gap-2",
  filterLabel: "text-sm font-medium text-zinc-700 dark:text-zinc-300",
  filterValue: "text-sm text-black dark:text-zinc-100",
  gameSelect:
    "rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white/30",

  prSummaryGrid: "grid grid-cols-1 gap-3 sm:grid-cols-3",
  prCard: "rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900",
  prCardLabel: "text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
  prCardValue: "mt-1 text-2xl font-semibold text-black dark:text-zinc-50",
  prCardSubtext: "mt-1 text-xs text-zinc-500 dark:text-zinc-400",

  boardAndTablesRow: "flex flex-col gap-6 lg:flex-row lg:items-start",
  boardColumn: "flex-1 lg:min-w-0",
  tablesColumn:
    "flex w-full flex-col gap-6 lg:max-h-[80vh] lg:w-[380px] lg:shrink-0 lg:overflow-y-auto",
} as const;
