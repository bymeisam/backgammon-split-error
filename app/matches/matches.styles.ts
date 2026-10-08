import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers
// MatchesPage, the only component defined in this file. The page
// container, width and title row are PageShell's; the table look is
// shared. Below md the table keeps Match ID, Opponent, Your PR and the
// chevron.
export const style = {
  analysisLink: shared.textLink,
  // The "Loading…" text. (The "Page N of M" indicator is the shared Pager's.)
  mutedText: shared.mutedText,
  errorBox: shared.errorBox,
  tableWrapper: shared.tableWrapper,
  table: shared.table,
  tableHeadCell: shared.tableHeadCell,
  tableHeadCellNumeric: shared.tableHeadCellNumeric,
  tableHeadCellWide: clsx(shared.tableHeadCell, "max-md:hidden"),
  tableHeadCellWideNumeric: clsx(shared.tableHeadCellNumeric, "max-md:hidden"),
  chevronHeadCell: clsx(shared.tableHeadCell, "w-7"),
  tableRow: shared.tableRowClickable,
  rowLink: shared.tableRowLink,
  // Ids, dates, ratings, scores and errors: sans with tabular figures
  // (mono is for moves and equities only).
  idCell: shared.tableCellMuted,
  dateCell: clsx(shared.tableCellMuted, "max-md:hidden"),
  opponentCell: clsx(shared.tableCell, "font-medium"),
  ratingCell: clsx(shared.tableCellNumeric, "text-ink-muted max-md:hidden"),
  scoreCell: clsx(shared.tableCellMuted, "text-ink max-md:hidden"),
  numberCell: shared.tableCellNumeric,
  oppNumberCell: clsx(shared.tableCellNumeric, "text-ink-muted max-md:hidden"),
  chevronCell: shared.tableChevronCell,
  // "Your PR" / "Opp. PR": the label carries the hint (lib/sourcePr.ts).
  prHint: shared.hintLabel,
} as const;
