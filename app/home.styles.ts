import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers Home and the
// dashboard widgets defined in the same page.tsx (DueCardsWidget,
// RatingWidget, WeeklyMistakesWidget, LatestMatchesWidget, Widget,
// WidgetFallback). The page container/title are PageShell's.
export const style = {
  // The small widgets in a row (one column on narrow screens).
  widgetGrid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
  widget: clsx(shared.card, "flex flex-col gap-3 p-5"),
  widgetTitle: shared.overline,
  // Big figures (due count, rating) in the serif.
  bigNumber: "font-serif text-figure font-medium tabular-nums lining-nums text-ink",
  widgetNote: "text-xs text-ink-faint",
  widgetLink: clsx(shared.textLink, "text-sm"),
  // The due-cards widget's action: the app's main loop, a real button.
  reviewButton: clsx(shared.buttonPrimary, "mt-auto self-start"),
  errorText: shared.errorText,
  mutedText: shared.mutedText,

  // This week's mistakes: a small checker/cube × error/blunder grid.
  miniTable: "w-full text-[13px]",
  miniHeadCell: "pb-1.5 text-right text-xs font-medium text-ink-faint",
  miniHeadCellLeft: "pb-1.5 text-left text-xs font-medium text-ink-faint",
  miniLabelCell: "border-t border-line py-1.5 text-ink-muted",
  miniNumberCell: "border-t border-line py-1.5 text-right tabular-nums text-ink",
  miniTotalRow: "font-semibold",

  // Latest matches: the shared table look.
  tableWrapper: shared.tableWrapper,
  table: shared.table,
  tableHeadRow: shared.tableHeadRow,
  tableHeadCell: shared.tableHeadCell,
  tableRow: shared.tableRow,
  tableCell: shared.tableCellMuted,
  opponentCell: clsx(shared.tableCell, "font-medium"),
  matchLink: "underline-offset-4 hover:underline",
  sectionHeader: "flex flex-wrap items-baseline justify-between gap-3",
  sectionTitle: shared.pageSectionTitle,
  section: "flex flex-col gap-3.5",
} as const;
