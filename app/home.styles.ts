import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers Home and the
// dashboard widgets defined in the same page.tsx (DueCardsWidget,
// RatingWidget, WeeklyMistakesWidget, LatestMatchesWidget,
// RepeatedBlundersWidget, Widget, WidgetFallback). The page container,
// date overline and title are PageShell's.
export const style = {
  // Function, 1 param -> passed directly. The widgets in a row: the due
  // widget a little wider (write mode only); one column below md.
  widgetGrid: (withDue: boolean): string =>
    clsx(
      "grid grid-cols-1 gap-[18px]",
      withDue ? "md:grid-cols-[1.25fr_1fr_1fr]" : "md:grid-cols-2"
    ),
  widget: clsx(shared.card, "flex flex-col gap-3 px-[22px] pb-5 pt-[22px] md:min-h-[200px]"),
  widgetTitle: shared.overline,
  // Big figures (due count, rating) in the serif.
  bigNumber: "font-serif text-figure font-medium tabular-nums lining-nums text-ink",
  bigNumberUnit: "ml-1.5 font-sans text-base font-normal tracking-normal text-ink-muted",
  bigNumberDecimals: "text-ink-faint",
  widgetNote: "text-[12.5px] text-ink-faint",
  // The due widget's "3 new · 0 review" (the /review header's counts).
  dueSplit: "flex gap-4 text-[13px] text-ink-muted",
  dueSplitCount: "font-semibold text-ink",
  // "N more held back by today's limits": due cards beyond the daily limits.
  dueHeld: "text-xs text-ink-faint",
  widgetLink: shared.textLink,
  widgetActions: "mt-auto flex items-center gap-3.5",
  // The due widget's action: the app's main loop, a real button.
  errorText: shared.errorText,
  mutedText: shared.mutedText,
  srOnly: "sr-only",

  // This week's mistakes: a small checker/cube × error/blunder grid.
  miniTable: "w-full border-collapse text-[13px]",
  miniHeadCell: "pb-1.5 text-right text-[11.5px] font-medium text-ink-faint",
  miniHeadCellLeft: "pb-1.5 text-left",
  // Function, 1 param -> passed directly. A severity square in the header.
  miniDot: (tier: "error" | "blunder"): string =>
    clsx("mr-1.5 inline-block h-[7px] w-[7px] rounded-[2px] align-[1px]", tier === "error" ? "bg-error" : "bg-blunder"),
  // Function, 1 param -> passed directly. The total row is bold.
  miniRow: (isTotal: boolean): string => clsx(isTotal && "font-semibold"),
  // Function, 1 param -> passed directly.
  miniLabelCell: (isTotal: boolean): string =>
    clsx("border-t border-line py-1.5 text-left", isTotal ? "text-ink" : "text-ink-muted"),
  miniNumberCell: "border-t border-line py-1.5 text-right tabular-nums text-ink",
  // Errors and blunders as shares of one bar.
  stackBar: "flex h-1.5 overflow-hidden rounded-[3px] bg-sunken",
  stackBarError: "block h-full bg-error",
  stackBarBlunder: "block h-full bg-blunder",

  // Latest matches and the repeated blunders, side by side from md.
  lowerRow: "grid grid-cols-1 items-start gap-7 md:grid-cols-[2fr_1fr] md:gap-[18px]",
  section: "flex min-w-0 flex-col gap-3.5",
  sectionHeader: "flex items-baseline justify-between gap-4",
  sectionTitle: shared.pageSectionTitle,

  // Latest matches: the shared table, the whole row a link.
  tableWrapper: shared.tableWrapper,
  table: shared.table,
  tableHeadCell: shared.tableHeadCell,
  tableHeadCellWide: clsx(shared.tableHeadCell, "max-md:hidden"),
  tableHeadCellNumeric: shared.tableHeadCellNumeric,
  chevronHeadCell: clsx(shared.tableHeadCell, "w-7 max-md:hidden"),
  tableRow: shared.tableRowClickable,
  dateCell: shared.tableCellMuted,
  opponentCell: clsx(shared.tableCell, "font-medium"),
  matchLink: shared.tableRowLink,
  scoreCell: clsx(shared.tableCellMuted, "text-ink max-md:hidden"),
  prCell: shared.tableCellNumeric,
  prValue: "flex items-center justify-end gap-2.5",
  prBar: "block h-1 rounded-[2px] bg-line-strong",
  chevronCell: clsx(shared.tableChevronCell, "max-md:hidden"),

  // Most repeated blunders: one card, a row per position.
  repeatCard: clsx(shared.card, "flex flex-col py-1.5"),
  repeatItem: clsx(
    "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-line px-[18px] py-[11px] transition-colors first:border-t-0 hover:bg-sunken",
    shared.focusRingInset
  ),
  repeatPosition: "truncate font-mono text-[12.5px] text-ink-muted",
  repeatTimes: "font-serif text-lg font-medium leading-none tabular-nums lining-nums text-ink",
  repeatTimesUnit: "ml-0.5 font-sans text-[11px] text-ink-faint",
  // "Your PR": the label carries the hint (lib/sourcePr.ts).
  prHint: shared.hintLabel,
} as const;
