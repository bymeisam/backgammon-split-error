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
  // The Filter disclosure's row, and the form it shows.
  filterRow: "-mt-3 flex flex-wrap items-center gap-x-4 gap-y-3",
  form: shared.filterBar,
  applyButton: shared.buttonSecondary,
  noFilterText: shared.faintText,
  mutedText: shared.mutedText,
  resultText: "text-[13.5px] tabular-nums text-ink-muted",
  fallbackRow: "flex items-center gap-2 text-sm text-ink-faint",
  fallbackSpinner: shared.spinner,

  positionTable: shared.tableWrapper,
  positionTableInner: shared.table,
  positionTableHeadCell: shared.tableHeadCell,
  positionTableHeadCellNumeric: shared.tableHeadCellNumeric,
  positionRow: shared.tableRowClickable,
  positionCell: shared.tableCell,
  positionLink: clsx("font-mono text-[12.5px] text-ink-muted", shared.tableRowLink),
  positionCountCell: shared.tableCellNumeric,
  occurrenceCount: "font-serif text-lg font-medium leading-none tabular-nums text-ink",
  occurrenceTimes: "ml-0.5 font-sans text-[11px] text-ink-faint",
  chevronCell: shared.tableChevronCell,
} as const;
