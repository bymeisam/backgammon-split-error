import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers
// ReviewCardsPage (page.tsx) and CardActions.tsx (same folder, only used
// here). The filter dropdowns and pagination are shared components with
// their own styles. The page container, width, breadcrumbs and title are
// PageShell's.
export const style = {
  link: shared.textLink,
  // The filter bar: no box, a row of labelled controls.
  form: shared.filterBar,
  applyButton: shared.buttonSecondary,
  mutedText: shared.mutedText,
  tableWrapper: shared.tableWrapper,
  table: shared.table,
  headCell: clsx(shared.tableHeadCell, "border-b border-line"),
  // Function, 1 param -> passed directly. Suspended rows are dimmed.
  row: (suspended: boolean): string => clsx(shared.tableRow, "align-top", suspended && "opacity-60"),
  cell: shared.tableCell,
  // The move played: notation, so mono.
  monoCell: clsx(shared.tableCell, "font-mono text-[13px]"),
  numCell: shared.tableCellNumeric,
  positionText: "font-mono text-xs text-ink-muted",
  positionLink: clsx(shared.textLink, "text-xs"),
  tagChip: "mr-1 inline-flex rounded-full border border-line bg-sunken px-2 py-0.5 text-xs text-ink-muted",
  stateText: "text-xs text-ink-faint",
  actions: "flex flex-wrap gap-2",
  actionButton: shared.buttonSmall,
  deleteButton: shared.buttonDanger,
  errorText: "text-xs text-blunder-ink",
  modalOverlay: shared.modalOverlay,
  modalPanel: shared.modalPanel,
  modalHeading: shared.modalHeading,
  modalText: shared.modalText,
  modalButtons: shared.modalButtons,
  modalPrimaryButton: shared.modalPrimaryButton,
  modalSecondaryButton: shared.modalSecondaryButton,
} as const;
