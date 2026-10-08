import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers DecisionListWithDetail.tsx and its exclusive subcomponent
// DecisionCard.tsx (used only by DecisionListWithDetail, same folder). The
// list's own row/table markup is DecisionList.styles.ts's; listBadgeGroup
// stays here since it wraps DecisionListWithDetail's own renderDetailCell
// content (severity/classification badges + MoveDelta).
export const style = {
  // DecisionListWithDetail's own markup.
  emptyStateText: shared.mutedText,
  layout: "flex flex-col gap-6 lg:flex-row lg:items-start",
  cardColumn: "flex-1 lg:min-w-0",
  // 400px, and the list's move text may wrap, so the loss column is never
  // clipped.
  listWrapper: "flex w-full min-w-0 flex-col gap-2 lg:max-h-[80vh] lg:w-[400px] lg:shrink-0 lg:overflow-y-auto",
  listBadgeGroup: "inline-flex flex-wrap items-center gap-1.5",

  // DecisionCard.tsx's own markup. On a phone the card's padding is small,
  // so the board keeps most of the width.
  card: "flex flex-col gap-4 rounded-card border border-line bg-surface p-3 shadow-card sm:p-5",
  cardHeader: "flex flex-wrap items-center justify-between gap-2 text-xs",
  cardBadgeGroup: "flex flex-wrap items-center gap-2",
  cardErrorText: "tabular-nums text-ink-muted",
  cardLinkGroup: "flex flex-wrap items-center gap-4",
  // Shared by "View match" and "View on Galaxy".
  cardMatchLink: shared.textLink,
} as const;
