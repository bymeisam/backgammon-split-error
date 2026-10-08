import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers
// MatchesAnalysisPage and every component defined in this same page.tsx
// file (CountLink, BreakdownTable). The page container, width and title are
// PageShell's; the table look is shared.
export const style = {
  countLink: "underline-offset-4 hover:text-ink hover:underline",

  // BreakdownTable — reused for both the classification and category
  // sections.
  tableWrapper: shared.tableWrapper,
  table: shared.table,
  tableHeadRow: shared.tableHeadRow,
  tableHeadCell: shared.tableHeadCell,
  tableRow: `${shared.tableRow} transition-colors hover:bg-sunken`,
  tableKeyCell: shared.tableCell,
  // Shared by all 4 numeric cells (Blunders/Errors/Good/Total) in a row.
  tableNumberCell: shared.tableCellMuted,

  backLink: shared.textLink,
  // Shared by both sections (classification and category breakdowns).
  section: "flex flex-col gap-3.5",
  sectionTitle: shared.pageSectionTitle,
} as const;
