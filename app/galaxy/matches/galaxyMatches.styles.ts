import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers MatchesPage
// (page.tsx) and TokenModal.tsx, folded into one file since TokenModal is
// exclusively used by this page and lives in the same folder. `errorBox` is
// shared by both components.
export const style = {
  // --- page.tsx --- (the page container, width and title row are
  // PageShell's)
  jumpForm: "flex flex-wrap items-center gap-2",
  matchIdInput: clsx(shared.input, "w-32 py-1.5"),
  // Shared by "Jump to match" and "Show JSON".
  pillButton: shared.buttonSecondary,
  divider: "mx-1 h-5 w-px bg-line",
  gameIndexInput: clsx(shared.input, "w-16 py-1.5"),
  jsonBox: clsx(shared.card, "p-4"),
  jsonBoxHeader: "mb-2 flex items-center justify-between",
  jsonBoxLabel: shared.overline,
  jsonBoxActions: "flex items-center gap-3",
  // Shared by the "Copy"/"Close" json-box buttons.
  jsonLinkButton: clsx(shared.textLink, "text-xs"),
  // Shared by the json-box "Loading…" text and the list "Loading…" text.
  mutedText: shared.mutedText,
  jsonPre: "max-h-[60vh] overflow-auto rounded-control bg-sunken p-3 font-mono text-xs text-ink",
  tableWrapper: shared.tableWrapper,
  table: shared.table,
  theadRow: shared.tableHeadRow,
  headCell: shared.tableHeadCell,
  // Rating and the two PRs: right-aligned tabular figures, as on /matches.
  headCellNumeric: shared.tableHeadCellNumeric,
  // "Your PR" / "Opponent PR": the label carries the hint (lib/sourcePr.ts).
  prHint: shared.hintLabel,
  bodyRow: shared.tableRowClickable,
  opponentCell: clsx(shared.tableCell, "font-medium"),
  // The score cell.
  monoCell: shared.tableCellMuted,
  // Shared by the rating, your-PR and opponent-PR cells.
  numericCell: shared.tableCellNumeric,
  actionCell: "px-4 py-2.5 text-right",
  syncingLabel: "inline-flex items-center gap-1.5 text-xs text-ink-faint",
  spinner: shared.spinner,
  syncedLabel: "text-xs font-medium text-best-ink",
  syncButton: shared.buttonSmall,

  // --- TokenModal.tsx ---
  modalHeading: shared.modalHeading,
  modalSubtext: clsx(shared.modalText, "mt-1"),
  tabRow: "inline-flex w-fit gap-1 rounded-control bg-sunken p-[3px]",
  // Function, 1 param -> passed directly. A segmented control: the active
  // tab raised on the track.
  tabButton: (isActive: boolean): string =>
    clsx(
      "rounded-[7px] px-4 py-1.5 text-sm font-medium transition-colors",
      isActive ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"
    ),
  // Shared by the curl-command label and the authorization label.
  fieldWrapper: "flex flex-col gap-2",
  fieldLabel: "text-sm font-medium text-ink-muted",
  // Shared by the curl textarea and the plain authorization input.
  textInput: clsx(shared.input, "p-3 font-mono text-xs"),
  errorBox: shared.errorBox,
  connectButton: clsx(shared.buttonPrimary, "h-10 px-6"),
} as const;
