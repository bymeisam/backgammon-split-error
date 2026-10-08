import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local to this shared component (see .claude/skills/styling-conventions)
// — covers MistakesSection.tsx's own markup and its exclusive subcomponent
// PRCard (same file, used nowhere else). MoveDelta/Dice/DecisionList are
// shared leaves with their own styles files; only the Roll column's
// empty-state span (mistakeTableNoRollText, passed as DecisionList's
// rollEmptyPlaceholder prop) stays here.
export const style = {
  mistakeTableNoRollText: "text-xs text-ink-faint",

  // MistakesSection's own top-level markup.
  sectionWrapper: "flex flex-col gap-6 border-t border-line pt-8",
  sectionTitle: shared.pageSectionTitle,
  mutedText: shared.mutedText,

  // data-testid wrapper (e2e/board-visual.spec.ts's "mistakes-section"
  // screenshot) — the same flex-col gap-6 as sectionWrapper.
  mistakesSectionChrome: "flex flex-col gap-6",
  filtersRow: "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
  filterGroup: "flex flex-col gap-1.5",
  filterLabel: "text-xs font-medium text-ink-faint",
  filterValue: "text-sm text-ink",
  gameSelect: shared.filterSelect,

  prSummaryGrid: "grid grid-cols-1 gap-4 sm:grid-cols-3",
  prCard: clsx(shared.card, "p-5"),
  prCardLabel: shared.overline,
  prCardValue: "mt-2 font-serif text-[2.5rem] font-medium leading-none tabular-nums text-ink",
  prCardSubtext: "mt-2 text-xs text-ink-faint",

  boardAndTablesRow: "flex flex-col gap-6 lg:flex-row lg:items-start",
  boardColumn: "flex-1 lg:min-w-0",
  // 400px, and the move text may wrap, so the loss column is never clipped.
  tablesColumn: "flex w-full min-w-0 flex-col gap-6 lg:max-h-[80vh] lg:w-[400px] lg:shrink-0 lg:overflow-y-auto",
} as const;
