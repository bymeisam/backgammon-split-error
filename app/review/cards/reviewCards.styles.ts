import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers
// ReviewCardsPage (page.tsx) and CardActions.tsx (same folder, only used
// here). The filter dropdowns and pagination are shared components with
// their own styles. The page container, width, breadcrumbs and title are
// PageShell's.
export const style = {
  link: shared.textLink,
  // The Filter disclosure's form; the disclosure itself is in PageShell's
  // header (its `controls`).
  form: shared.filterBar,
  applyButton: shared.buttonSecondary,
  // The result line ("3 cards") and the table under it.
  resultGroup: shared.resultGroup,
  resultRow: clsx(shared.resultRow, "tabular-nums"),
  tableWrapper: shared.tableWrapper,
  table: shared.table,
  headCell: shared.tableHeadCell,
  headCellNumeric: shared.tableHeadCellNumeric,
  // Type, Phase, Tags, Reps, Lapses and State are hidden below md, so
  // Position, Due and the actions fit at 390.
  headCellWide: clsx(shared.tableHeadCell, "max-md:hidden"),
  headCellNumericWide: clsx(shared.tableHeadCellNumeric, "max-md:hidden"),
  cellWide: clsx(shared.tableCell, "max-md:hidden"),
  numCellWide: clsx(shared.tableCellNumeric, "max-md:hidden"),
  // Function, 1 param -> passed directly. Suspended rows are dimmed.
  row: (suspended: boolean): string => clsx(shared.tableRow, "align-top", suspended && "opacity-60"),
  cell: shared.tableCell,
  // The move played: notation, so mono.
  monoCell: clsx(shared.tableCell, "font-mono text-[13px]"),
  numCell: shared.tableCellNumeric,
  // The mono summary ("6-5 · played 22/11"): below md it may wrap, but
  // only at the "·" separators (each part is a nowrap positionSegment), so
  // the actions column fits at 390.
  positionText: "font-mono text-[12.5px] text-ink-muted md:whitespace-nowrap",
  positionSegment: "whitespace-nowrap",
  // Wraps as one unit, below the mono line.
  positionLink: clsx(shared.textLink, "inline-block text-xs"),
  tagChip: clsx(shared.tagChip, "mr-1"),
  stateText: "text-xs text-ink-faint",
  // Stacked below md, in a row from md.
  actions: "flex flex-col items-end gap-1.5 md:flex-row md:items-center md:gap-2",
  actionButton: shared.buttonSmall,
  deleteButton: shared.buttonDanger,
  errorText: "text-xs text-blunder-ink",
  modalHeading: shared.modalHeading,
  modalText: shared.modalText,
  modalButtons: shared.modalButtons,
  modalPrimaryButton: shared.modalPrimaryButton,
  modalSecondaryButton: shared.modalSecondaryButton,
} as const;
