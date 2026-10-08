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
  // Page-level actions (38px). The primary colour is a theme token, so a
  // theme can make it something other than ink.
  buttonPrimary: clsx(
    buttonBase,
    "h-[38px] border border-primary bg-primary px-4 text-[13.5px] text-on-primary hover:bg-primary/86"
  ),
  buttonSecondary: clsx(
    buttonBase,
    "h-[38px] border border-line-strong bg-surface px-4 text-[13.5px] text-ink hover:bg-sunken"
  ),
  // In-card actions (34px): the note card, the replay's controls.
  buttonCompact: clsx(
    buttonBase,
    "h-[34px] border border-line-strong bg-surface px-3.5 text-[13px] text-ink hover:bg-sunken"
  ),
  buttonCompactPrimary: clsx(
    buttonBase,
    "h-[34px] border border-primary bg-primary px-3.5 text-[13px] text-on-primary hover:bg-primary/86"
  ),
  // A rounded toggle: the "Filter" button on the list pages.
  pill: "inline-flex items-center rounded-full border border-line bg-surface px-2.5 py-1 text-[12.5px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink",
  // Tag chips (the note card) and the dashed "+ tag" one.
  tagChip: "inline-flex items-center gap-1 rounded-full border border-line bg-sunken px-[9px] py-[3px] text-xs text-ink-muted",
  tagChipAdd:
    "inline-flex cursor-pointer items-center rounded-full border border-dashed border-line px-[9px] py-[3px] text-xs text-ink-muted hover:border-line-strong hover:text-ink",
  // A classification code (OG, MG, BLZ…): outlined, mono.
  codeChip:
    "inline-flex items-center rounded-[4px] border border-line-strong px-[5px] py-[3px] font-mono text-[10.5px] font-semibold leading-none text-ink-muted",
  // The small secondary button (table-row actions, the navbar's Sync).
  buttonSmall: clsx(
    buttonBase,
    "h-7 border border-line-strong bg-surface px-3 text-xs text-ink hover:bg-sunken"
  ),
  buttonDanger: clsx(
    buttonBase,
    "h-7 border border-line-strong bg-surface px-3 text-xs text-blunder-ink hover:border-blunder hover:bg-blunder-tint"
  ),
  // A label with a hover hint (title): a dotted underline says there's one.
  hintLabel: "cursor-help underline decoration-line-strong decoration-dotted underline-offset-[3px]",
  textLink:
    "text-[13px] font-medium text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-current",
  kbd: "rounded-[4px] border border-b-2 border-line-strong bg-sunken px-[5px] py-[2px] font-mono text-[11px] font-medium leading-none text-ink-muted",
  // The text button on cards ("Edit note", "Write note").
  textButton: "text-[12.5px] text-ink-muted underline underline-offset-[3px] hover:text-ink",

  // --- form controls ---
  input: clsx(
    "w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint",
    focusRingInset
  ),
  // Filter bar: no box, a row of labelled controls (/mistakes,
  // /repeated-positions, /review, /review/cards).
  filterBar: "flex flex-wrap items-end gap-x-4 gap-y-3",
  filterField: "flex flex-col gap-1.5 text-xs font-medium text-ink-faint",
  // Under the filter: the result line and the list it describes, one group
  // 14px apart (the page's section gap only separates the header from it).
  resultGroup: "flex flex-col gap-3.5",
  resultRow: "flex items-center justify-between gap-4 text-[13.5px] text-ink-muted",
  filterSelect: "h-[38px] rounded-control border border-line-strong bg-surface pl-3 pr-8 text-sm text-ink",

  // --- tables (dashboard, /matches, /matches/analysis, /repeated-positions,
  // /review/cards, /galaxy/matches) ---
  tableWrapper: "overflow-x-auto rounded-card border border-line bg-surface shadow-card",
  table: "w-full border-collapse text-left text-[13.5px]",
  tableHeadRow: "",
  tableHeadCell:
    "border-b border-line px-3.5 pb-2.5 pt-3.5 text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-ink-faint sm:px-[18px]",
  tableHeadCellNumeric:
    "border-b border-line px-3.5 pb-2.5 pt-3.5 text-right text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-ink-faint sm:px-[18px]",
  tableRow: "border-b border-line last:border-b-0",
  // A row that's itself a link target (the match lists): its main cell
  // holds a link stretched over the row (tableRowLink), so the whole row is
  // one link for the mouse and the keyboard.
  tableRowClickable: "relative cursor-pointer border-b border-line last:border-b-0 hover:[&>td]:bg-sunken",
  tableRowLink: clsx("after:absolute after:inset-0 after:content-['']", "focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"),
  tableCell: "px-3.5 py-[11px] text-ink sm:px-[18px]",
  tableCellMuted: "whitespace-nowrap px-3.5 py-[11px] tabular-nums text-ink-muted sm:px-[18px]",
  tableCellNumeric: "whitespace-nowrap px-3.5 py-[11px] text-right tabular-nums text-ink sm:px-[18px]",
  // The trailing "›" column of a clickable row.
  tableChevronCell: "w-7 px-3.5 py-[11px] text-right text-ink-faint sm:px-[18px]",

  // --- severity ---
  // A severity chip's shape, always sans (it sits inside mono cells too).
  severityChipShape:
    "inline-flex items-center rounded-[4px] px-1.5 py-[3px] font-sans text-[10.5px] font-semibold normal-case leading-none tracking-[0.02em]",
  // Function, 1 param -> passed directly. A filled chip in Galaxy's hue.
  // Just the colours: the chip shape is severityChipShape (Badge adds it).
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

  // --- modal --- A centred dialog over the scrim: /mistakes' "Add all
  // to review", /review/cards' delete confirmation, the "?" help and
  // /galaxy/matches' TokenModal.
  // The native <dialog> (app/components/ui/Modal.tsx) in the top layer: it
  // escapes the navbar's backdrop-filter containing block.
  modalDialog:
    "m-auto w-[calc(100%-3rem)] max-w-lg overflow-visible bg-transparent p-0 text-ink backdrop:bg-scrim backdrop:backdrop-blur-[2px]",
  // whitespace-normal: a dialog rendered inside the navbar (the "?" help)
  // would otherwise inherit its nowrap and run past the panel's edge.
  modalPanel:
    "flex max-h-[calc(100dvh-3rem)] w-full max-w-lg flex-col gap-4 overflow-y-auto overflow-x-hidden whitespace-normal rounded-card border border-line bg-surface p-6 shadow-raised",
  modalHeading: "font-serif text-heading font-medium text-ink",
  modalText: "text-sm text-ink-muted",
  modalError: "text-sm text-blunder-ink",
  modalButtons: "flex justify-end gap-2",
  modalPrimaryButton: clsx(
    buttonBase,
    "h-[38px] border border-primary bg-primary px-4 text-[13.5px] text-on-primary hover:bg-primary/86"
  ),
  modalSecondaryButton: clsx(
    buttonBase,
    "h-[38px] border border-line-strong bg-surface px-4 text-[13.5px] text-ink hover:bg-sunken"
  ),
} as const;
