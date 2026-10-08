import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers
// ReviewCardsPage (page.tsx) and CardActions.tsx (same folder, only used
// here). The filter dropdowns and pagination are shared components with
// their own styles. The page container, width, breadcrumbs and title are
// PageShell's.
export const style = {
  link: shared.textLink,
  // The Filter disclosure's row, and the form it shows.
  filterRow: "-mt-3 flex flex-wrap items-center gap-x-4 gap-y-3",
  form: shared.filterBar,
  applyButton: shared.buttonSecondary,
  mutedText: shared.mutedText,
  tableWrapper: shared.tableWrapper,
  table: shared.table,
  headCell: shared.tableHeadCell,
  headCellNumeric: shared.tableHeadCellNumeric,
  // Function, 1 param -> passed directly. Suspended rows are dimmed.
  row: (suspended: boolean): string => clsx(shared.tableRow, "align-top", suspended && "opacity-60"),
  cell: shared.tableCell,
  // The move played: notation, so mono.
  monoCell: clsx(shared.tableCell, "font-mono text-[13px]"),
  numCell: shared.tableCellNumeric,
  positionText: "font-mono text-[12.5px] text-ink-muted",
  positionLink: clsx(shared.textLink, "text-xs"),
  tagChip: clsx(shared.tagChip, "mr-1"),
  stateText: "text-xs text-ink-faint",
  actions: "flex flex-wrap gap-2",
  actionButton: shared.buttonSmall,
  deleteButton: shared.buttonDanger,
  errorText: "text-xs text-blunder-ink",
  modalHeading: shared.modalHeading,
  modalText: shared.modalText,
  modalButtons: shared.modalButtons,
  modalPrimaryButton: shared.modalPrimaryButton,
  modalSecondaryButton: shared.modalSecondaryButton,
} as const;
