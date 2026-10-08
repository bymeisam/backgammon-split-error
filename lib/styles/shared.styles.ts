import clsx from "clsx";
import type { SeverityTier } from "@/lib/badges";

// Cross-cutting style values (see .claude/skills/styling-conventions) —
// used by otherwise-unrelated call sites. Every colour here is a theme
// token (app/globals.css, app/themes/*.css), so nothing needs a dark:
// variant.
//
// Severity has one source: this file. Galaxy's own hues are the fills
// (bg-best #36D399, bg-good #65758B, bg-error #FBBD23, bg-blunder #F43E5C,
// reports/2026-10-07-galaxy-client-comparison.md), with the text on each
// fill from the on-* tokens (dark on green, amber and red, white on slate).
// Severity as text uses the darker *-ink tokens (Galaxy's amber is 1.7:1 as
// text on the light page), and as a row background the *-tint tokens.
// Board arrows have their own arrow-* tokens (BoardPanel.styles.ts).

// Keyboard focus moved inside the element, for table rows and inputs whose
// neighbours would hide an outside ring. The plain ring (outside, 2px
// offset) is global, in app/globals.css.
const focusRingInset = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-control text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export const style = {
  focusRingInset,

  // --- surfaces and text ---
  card: "rounded-card border border-line bg-surface shadow-card",
  overline: "text-overline uppercase text-ink-faint",
  mutedText: "text-sm text-ink-muted",
  faintText: "text-sm text-ink-faint",
  errorText: "text-sm text-blunder-ink",
  errorBox: "rounded-control border border-blunder/40 bg-blunder-tint px-3 py-2 text-sm text-blunder-ink",
  infoBox: "rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink-muted",
  pageSectionTitle: "font-serif text-heading font-medium text-ink",
  spinner: "h-3 w-3 animate-spin rounded-full border-2 border-line-strong border-t-ink-muted",

  // --- buttons ---
  buttonPrimary: clsx(buttonBase, "h-9 bg-ink px-4 text-paper hover:bg-ink/85"),
  buttonSecondary: clsx(buttonBase, "h-9 border border-line-strong bg-surface px-4 text-ink hover:bg-sunken"),
  // The small secondary button (table-row actions, the navbar's Sync).
  buttonSmall: clsx(
    buttonBase,
    "h-7 border border-line-strong bg-surface px-3 text-xs text-ink hover:bg-sunken"
  ),
  buttonDanger: clsx(
    buttonBase,
    "h-7 border border-line-strong bg-surface px-3 text-xs text-blunder-ink hover:border-blunder hover:bg-blunder-tint"
  ),
  textLink:
    "font-medium text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-current",
  kbd: "rounded border border-b-2 border-line-strong bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-ink-muted",

  // --- form controls ---
  input: clsx(
    "w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint",
    focusRingInset
  ),
  // Filter bar: no box, a row of labelled controls (/mistakes,
  // /repeated-positions, /review, /review/cards).
  filterBar: "flex flex-wrap items-end gap-x-4 gap-y-3",
  filterField: "flex flex-col gap-1.5 text-xs font-medium text-ink-faint",
  filterSelect: "h-9 rounded-control border border-line-strong bg-surface pl-3 pr-8 text-sm text-ink",

  // --- tables (dashboard, /matches, /matches/analysis, /repeated-positions,
  // /review/cards, /galaxy/matches) ---
  tableWrapper: "overflow-x-auto rounded-card border border-line bg-surface shadow-card",
  table: "w-full border-collapse text-left text-sm",
  tableHeadRow: "border-b border-line",
  tableHeadCell: "px-4 pb-2.5 pt-3.5 text-overline uppercase text-ink-faint",
  tableHeadCellNumeric: "px-4 pb-2.5 pt-3.5 text-right text-overline uppercase text-ink-faint",
  tableRow: "border-b border-line last:border-b-0",
  // A row that's itself a link target (the match lists).
  tableRowClickable: clsx("cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-sunken", focusRingInset),
  tableCell: "px-4 py-2.5 text-ink",
  tableCellMuted: "whitespace-nowrap px-4 py-2.5 tabular-nums text-ink-muted",
  tableCellNumeric: "px-4 py-2.5 text-right tabular-nums text-ink",

  // --- severity ---
  // Function, 1 param -> passed directly. A filled chip in Galaxy's hue.
  severityChip: (tier: SeverityTier): string =>
    clsx(
      tier === "best" && "border-best bg-best text-on-best",
      tier === "good" && "border-good bg-good text-on-good",
      tier === "error" && "border-error bg-error text-on-error",
      tier === "blunder" && "border-blunder bg-blunder text-on-blunder"
    ),
  // Function, 1 param -> passed directly. Severity as text (moves, losses,
  // the verdict).
  severityText: (tier: SeverityTier): string =>
    clsx(
      tier === "best" && "text-best-ink",
      tier === "good" && "text-good-ink",
      tier === "error" && "text-error-ink",
      tier === "blunder" && "text-blunder-ink"
    ),
  // Galaxy's blue cube square, for a cube row that isn't an error or
  // blunder.
  cubeSquareDefault: "border-cube-default bg-cube-default text-on-cube-default",

  // --- modal --- A centred dialog over a dimmed page: /mistakes' "Add all
  // to review", /review/cards' delete confirmation, the "?" help and
  // /galaxy/matches' TokenModal.
  modalOverlay: "fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6 backdrop-blur-[2px]",
  modalPanel:
    "flex max-h-[calc(100dvh-3rem)] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-card border border-line bg-surface p-6 shadow-raised",
  modalHeading: "font-serif text-heading font-medium text-ink",
  modalText: "text-sm text-ink-muted",
  modalError: "text-sm text-blunder-ink",
  modalButtons: "flex justify-end gap-2",
  modalPrimaryButton: clsx(buttonBase, "h-9 bg-ink px-4 text-paper hover:bg-ink/85"),
  modalSecondaryButton: clsx(buttonBase, "h-9 border border-line-strong bg-surface px-4 text-ink hover:bg-sunken"),
} as const;
