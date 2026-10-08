import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers
// RepeatedPositionsPage and every component defined in this same
// page.tsx file (FilterSelects, PositionListSection, PositionListFallback,
// PositionDetailSection). Same page shell as app/mistakes/mistakes.styles.ts;
// the filter dropdowns and pagination row are shared components with their
// own styles. The page container, width and title are PageShell's.
export const style = {
  backLink: shared.textLink,
  // The filter bar: no box, a row of labelled controls.
  form: shared.filterBar,
  applyButton: shared.buttonSecondary,
  noFilterText: shared.faintText,
  mutedText: shared.mutedText,
  fallbackRow: "flex items-center gap-2 text-sm text-ink-faint",
  fallbackSpinner: shared.spinner,

  positionTable: shared.tableWrapper,
  positionTableInner: shared.table,
  positionTableHead: shared.tableHeadRow,
  positionTableHeadCell: shared.tableHeadCell,
  positionRow: `${shared.tableRow} transition-colors hover:bg-sunken`,
  positionCell: shared.tableCell,
  positionBadgeCell: shared.tableCell,
  positionIdText: "font-mono text-xs text-ink-muted",
  occurrenceCount: "font-semibold tabular-nums text-ink",
  viewLink: shared.textLink,
} as const;
