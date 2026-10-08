import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// What a body cell holds. text: names and labels (ink). muted: dates, IDs
// and other secondary values (nowrap, tabular figures, muted ink). numeric:
// counts, PR, ratings (right-aligned, tabular figures). chevron: the
// trailing "›" of a clickable row.
export type TableCellKind = "text" | "muted" | "numeric" | "chevron";

const CELL_CLASSES = {
  text: shared.tableCell,
  muted: shared.tableCellMuted,
  numeric: shared.tableCellNumeric,
  chevron: shared.tableChevronCell,
} as const satisfies Record<TableCellKind, string>;

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers Table.tsx (Table, TableHead, TableHeadCell, TableBody, TableRow,
// TableCell). The look is the shared table one. Every function takes the
// caller's own extra classes (`className`, from its own styles file), added
// on top: e.g. "max-md:hidden" for a column hidden on phones.
export const style = {
  // Function, 1 param -> passed directly.
  wrapper: (className: string | undefined): string => clsx(shared.tableWrapper, className),
  table: shared.table,
  // Function, 2 params -> passed directly.
  headCell: (numeric: boolean, className: string | undefined): string =>
    clsx(numeric ? shared.tableHeadCellNumeric : shared.tableHeadCell, className),
  // Function, 2 params -> passed directly. A clickable row is one link
  // (its main cell's link carries shared.tableRowLink).
  row: (clickable: boolean, className: string | undefined): string =>
    clsx(clickable ? shared.tableRowClickable : shared.tableRow, className),
  // Function, 2 params -> passed directly.
  cell: (kind: TableCellKind, className: string | undefined): string => clsx(CELL_CLASSES[kind], className),
} as const;
