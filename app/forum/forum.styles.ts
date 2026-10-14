import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// The small "Best" tag on the analysis panel's best option and best cube
// cell: the review card's optionTag shape, in ink-muted (ink-faint isn't
// checked on the Best wash).
const bestTag = "whitespace-nowrap font-sans text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-muted";

const proposalChipBase = "inline-flex min-h-[34px] max-w-full items-center gap-1 rounded-control border border-line px-2.5 py-1 text-sm leading-5 text-ink";

export const style = {
  list: "flex flex-col gap-3",
  stack: "flex flex-col gap-6",
  row: "flex flex-col gap-1 p-4",
  // A /forum list card: its title link is stretched over the whole card
  // (listTitleLink), so the card is one link for the mouse and the keyboard.
  listRow: "relative flex flex-col gap-1 p-4 hover:border-line-strong",
  title: "font-serif text-heading text-ink",
  listTitleLink: clsx("font-serif text-heading text-ink", shared.tableRowLink),
  meta: "text-sm text-ink-muted",
  body: "whitespace-pre-wrap text-ink",
  form: "flex flex-col gap-4",
  input: shared.input,
  actions: "flex flex-wrap gap-3",
  // The Reply button sits at the end of the form instead of stretching.
  formActions: "flex justify-end",
  attachmentList: "flex flex-col gap-4",
  attachment: "flex flex-col gap-3 rounded-card border border-line bg-surface p-4",
  attachmentHeader: "flex items-center justify-between gap-3",
  attachmentTitle: shared.overline,
  attachmentLabel: "font-medium text-ink",
  error: shared.errorBox,
  // No padding on phones, so the board (which scales to fit) gets the full
  // width; the caption keeps its own inset there.
  position: "rounded-card border border-line bg-sunken p-0 pb-2 sm:p-2",
  attachmentMeta: "flex flex-col gap-1 border-b border-line px-2 pb-2 pt-2 text-xs text-ink-muted sm:px-0 sm:pt-0",
  // "Position 1 · 5-point match · 3–2 · 6-4 to play"
  caption: "text-sm text-ink",
  originLink: clsx(shared.textLink, "self-start text-xs"),
  gnuIds: "flex flex-col gap-1",
  gnuIdsSummary: "cursor-pointer select-none",
  identifier: "font-mono text-ink-muted",
  // The new-post form's read-only preview of a match decision.
  preview: "flex flex-col gap-2 rounded-card border border-line bg-sunken p-0 pb-2 sm:p-2",
  // Caps the preview board's width from sm up, so it doesn't fill the form.
  // The preview sits on a sunken panel, where the shared board drop shadow
  // reads heavy: drop it here only. `.x>svg` outranks the svg's own class.
  previewBoard: "w-full sm:max-w-md [&>svg]:drop-shadow-none",
  previewCaption: "px-2 pt-2 text-sm text-ink sm:px-0 sm:pt-0",
  previewChange: "self-start px-2 sm:px-0",
  // Quiet, at the end of the attachment list, not stretched across it.
  addPosition: "self-start",
  modalHeading: shared.modalHeading,
  modalText: shared.modalText,
  modalButtons: shared.modalButtons,
  proposalDraft: "flex flex-col items-start gap-3 border-t border-line pt-3",
  proposalField: "flex w-full max-w-xl flex-col gap-1.5",
  proposalLabel: "text-sm font-medium text-ink",
  proposalOptions: "flex flex-wrap gap-2",
  proposalChipList: "flex flex-wrap gap-2",
  proposalChip: clsx(proposalChipBase, "flex-wrap whitespace-normal text-left"),
  proposalInteractiveChip: clsx(proposalChipBase, "h-auto flex-wrap justify-start whitespace-normal text-left hover:bg-sunken"),
  proposalPosition: "flex min-w-0 flex-wrap",
  proposalPositionSegment: "inline-flex whitespace-nowrap",
  proposalSeparator: "mx-1 shrink-0",
  proposalTrailingSeparator: "ml-1 shrink-0",
  proposalCubeAction: "inline-flex shrink-0 whitespace-nowrap",
  proposalCheckerMove: "inline-flex shrink-0 items-center gap-1 whitespace-nowrap",
  proposalView: "shrink-0 text-xs text-ink-muted",
  proposalChecker: "font-mono",
  proposalTally: "mt-3 border-t border-line px-2 pt-3 sm:px-0",
  proposalTallySummary: "cursor-pointer text-sm text-ink-muted",
  proposalTallyList: "mt-3 flex flex-col gap-2",
  proposalTallyRow: "flex min-w-0 items-center gap-2",
  proposalTallyChip: "min-w-0",
  proposalCount: "shrink-0 tabular-nums text-sm text-ink-muted",
  proposalBoard: "w-full sm:max-w-md md:max-w-xl",
  proposalModalText: "text-sm text-ink-muted",
  reply: "flex flex-col gap-1 border-t border-line pt-4",
  // HideAnalysisCheckbox (new-post form, post edit): the checkbox row with
  // its one-line hint underneath. py-1 brings the row near 32px on phones.
  checkboxField: "flex flex-col",
  checkboxLabel: "flex items-center gap-2 py-1 text-sm text-ink",
  checkbox: "h-4 w-4 shrink-0 accent-ink",
  // Indented to line up with the label text (checkbox width + gap).
  checkboxHint: "pl-6 text-xs text-ink-muted",

  // DecisionAnalysisPanel, under a game-sourced position's board. Inset
  // like the caption on phones, where the position panel has no padding.
  // A hairline above it, so it reads as its own section and not as a third
  // board-explorer control.
  analysis: "mt-1 flex flex-col gap-3 border-t border-line px-2 pt-3 sm:px-0",
  // The "Engine analysis" label with the Show/Hide button under it.
  analysisHeader: "flex flex-col items-start gap-2",
  analysisLabel: shared.overline,
  // Caps the checker table from sm up, so move, equity and loss sit together.
  analysisTable: "sm:max-w-xl",
  // Function, 1 param -> passed directly. The best option's row: Best tint
  // plus the Best bar on its first cell (as on the review card).
  analysisRow: (isBest: boolean): string => clsx(isBest && "bg-best-tint"),
  analysisRankCell: (isBest: boolean): string =>
    clsx("w-10 text-ink-muted", isBest && "shadow-[inset_3px_0_0_var(--color-best)]"),
  analysisMove: "font-mono",
  // "Best" after the best move, so Best isn't shown by colour alone.
  analysisBestTag: clsx("ml-2.5", bestTag),
  // Fixed-width number columns from sm up (header and cells): the move
  // column takes the slack. Phones keep the table's own column sizing.
  analysisNumberHead: "sm:w-24",
  analysisNumber: "font-mono sm:w-24",
  // The cube equities: three cells in one hairline card, the best one tinted.
  // Capped from sm up (as previewBoard), so the strip reads as one object.
  analysisEquities: "grid grid-cols-3 overflow-hidden rounded-card border border-line bg-surface sm:max-w-md",
  // Function, 1 param -> passed directly.
  analysisEquityCell: (isBest: boolean): string =>
    clsx(
      "flex flex-col gap-0.5 px-4 py-2.5 [&+&]:border-l [&+&]:border-line",
      isBest && "bg-best-tint shadow-[inset_0_3px_0_var(--color-best)]"
    ),
  // Function, 1 param -> passed directly. ink-faint is only guaranteed
  // 4.5:1 on paper and surface, so the best cell's label (on the Best wash)
  // uses ink-muted.
  analysisEquityLabel: (isBest: boolean): string =>
    clsx("flex items-center gap-1.5 text-[11.5px]", isBest ? "text-ink-muted" : "text-ink-faint"),
  // From sm up only: in a phone's narrow cell it wraps and drops the best
  // value below the other two (the Best bar and wash still mark it there).
  analysisEquityBestTag: clsx("hidden sm:inline", bestTag),
  analysisEquityValue: "font-mono text-[15px] font-medium text-ink",
  analysisCube: "flex flex-col gap-2",
  analysisBest: "text-sm text-ink",
  analysisBestLabel: "font-medium",
  analysisBestDetail: "text-ink-muted",
  proposalDismiss: shared.modalButtons,
} as const;
