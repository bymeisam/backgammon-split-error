import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers
// RepeatedPositionsPage and every component defined in this same
// page.tsx file (FilterSelects, PositionListSection, PositionListFallback,
// PositionDetailSection). Same page shell as app/mistakes/mistakes.styles.ts;
// the filter dropdowns and pagination row are shared components with their
// own styles. The page container, width and title are PageShell's.
export const style = {
  backLink: shared.textLink,
  // The Filter disclosure's form; the disclosure itself is in PageShell's
  // header (its `controls`).
  form: shared.filterBar,
  applyButton: shared.buttonSecondary,
  noFilterText: shared.faintText,
  mutedText: shared.mutedText,
  // The result line and the table (or the drilldown's list) under it.
  resultGroup: shared.resultGroup,
  resultRow: clsx(shared.resultRow, "tabular-nums"),
  fallbackRow: "flex items-center gap-2 text-sm text-ink-faint",
  fallbackSpinner: shared.spinner,

  positionTable: shared.tableWrapper,
  positionTableInner: shared.table,
  positionTableHeadCell: shared.tableHeadCell,
  positionTableHeadCellNumeric: shared.tableHeadCellNumeric,
  // Severity is hidden below md, so Times faced fits at 390.
  severityHeadCell: clsx(shared.tableHeadCell, "max-md:hidden"),
  severityCell: clsx(shared.tableCell, "max-md:hidden"),
  // The chevron column's (empty) header, so the header border runs the
  // full width.
  chevronHeadCell: clsx(shared.tableHeadCell, "w-7"),
  positionRow: shared.tableRowClickable,
  positionCell: shared.tableCell,
  positionLink: clsx("font-mono text-[12px] text-ink-muted md:text-[12.5px]", shared.tableRowLink),
  positionCountCell: shared.tableCellNumeric,
  occurrenceCount: "font-serif text-lg font-medium leading-none tabular-nums lining-nums text-ink",
  occurrenceTimes: "ml-0.5 font-sans text-[11px] text-ink-faint",
  chevronCell: shared.tableChevronCell,
} as const;
