import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers
// MatchesPage, the only component defined in this file. The page
// container, width and title row are PageShell's; the table look is
// shared.
export const style = {
  analysisLink: shared.textLink,
  // The "Loading…" text. (The "Page N of M" indicator is the shared Pager's.)
  mutedText: shared.mutedText,
  errorBox: shared.errorBox,
  tableWrapper: shared.tableWrapper,
  table: shared.table,
  tableHeadRow: shared.tableHeadRow,
  // Shared by all head cells.
  tableHeadCell: shared.tableHeadCell,
  tableRow: shared.tableRowClickable,
  // Ids, dates, ratings, scores and errors: sans with tabular figures
  // (mono is for moves and equities only).
  tableCell: shared.tableCellMuted,
  opponentCell: `${shared.tableCell} font-medium`,
  // The Replay link's own cell — a click target inside a clickable row, so
  // it stops propagation before the row's own onClick (match navigation).
  replayCell: "px-4 py-2.5",
  replayLink: shared.textLink,
} as const;
