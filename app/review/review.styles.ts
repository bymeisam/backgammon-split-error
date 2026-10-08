import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers ReviewPage
// (page.tsx) and ReviewSession.tsx, which lives in this same folder and is
// only used here. BoardPanel, DecisionNote, TagEditor and FilterDisclosure
// are shared components with their own styles. The page container is
// PageShell's ("session" variant: no side padding below md, so the blocks
// here inset themselves).
export const style = {
  link: shared.textLink,
  // The filter form, inside the session bar's Filter disclosure.
  form: clsx(shared.filterBar, "pt-1"),
  applyButton: shared.buttonSecondary,
  readOnlyBox: clsx(shared.card, "p-5 text-sm text-ink-muted"),

  // --- ReviewSession.tsx ---
  // The session bar: one quiet line instead of a filter form and a counts
  // box.
  sessionBar: "-mb-1 flex flex-wrap items-center gap-[18px] px-4 md:px-0",
  sessionTitle: "font-serif text-[26px] font-display leading-none tracking-[-0.01em] text-ink",
  progress: "flex min-w-40 flex-1 items-center gap-3 text-[12.5px] tabular-nums text-ink-muted",
  track: "h-1 flex-1 overflow-hidden rounded-[2px] bg-line",
  trackFill: "block h-full bg-ink transition-[width]",

  layout: "grid grid-cols-1 items-start gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:gap-9",
  boardColumn: "min-w-0",
  // No overflow on this or any ancestor: the grade row is sticky below md.
  sideColumn: "flex min-w-0 flex-col gap-[18px] px-4 md:px-0",
  contextLine: "flex flex-wrap gap-2 text-[12.5px] text-ink-faint",
  contextStrong: "font-medium text-ink-muted",
  question: "mt-1.5 font-serif text-[26px] font-display leading-[1.15] tracking-[-0.012em] text-ink md:text-[30px]",
  questionAsk: "font-normal italic text-ink-muted",
  optionList: "flex flex-col gap-2",
  optionButton: clsx(
    "flex w-full items-center gap-3.5 rounded-[11px] border border-line bg-surface px-4 py-[13px] text-left text-ink shadow-card",
    "transition hover:-translate-y-px hover:border-ink-faint"
  ),
  optionKeyHint: clsx(shared.kbd, "inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] p-0"),
  optionMove: "font-mono text-base font-medium",
  hint: "text-xs text-ink-faint",

  // The back.
  verdictRow: "mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-3.5",
  // Function, 1 param -> passed directly. The verdict as a serif word in
  // the theme's title weight and emphasis style (italic, or upright in
  // Quiet Ink), in Best's or Blunder's ink.
  verdictWord: (correct: boolean): string =>
    clsx(
      "font-serif text-[28px] font-display font-emphasis leading-none",
      correct ? shared.severityText("best") : shared.severityText("blunder")
    ),
  verdictSub: "text-[13px] text-ink-muted",
  summaryGrid: "grid grid-cols-[auto_1fr] gap-x-[18px] gap-y-1.5 text-[13px]",
  summaryLabel: "text-ink-faint",
  summaryValue: "font-mono text-[13.5px] font-medium text-ink",
  summaryEquity: "font-normal text-ink-faint",
  doneValue: "tabular-nums text-ink",

  optionsCard: clsx(shared.card, "overflow-hidden"),
  optionsTable: "w-full border-collapse",
  optionsCaption: clsx(shared.overline, "px-4 pb-2 pt-3.5 text-left"),
  // Function, 3+ params -> one options object. An option row: the best one
  // tinted Best, the chosen wrong one tinted Blunder, the chosen right one
  // (not the best) on the sunken surface.
  optionRow: (opts: { isBest: boolean; isChosen: boolean; correct: boolean }): string =>
    clsx(
      opts.isBest && "bg-best-tint",
      opts.isChosen && !opts.isBest && (opts.correct ? "bg-sunken" : "bg-blunder-tint")
    ),
  // Function, 1 param (options object). The first cell carries the row's bar.
  optionCell: (opts: { isBest: boolean; chosenWrong: boolean }): string =>
    clsx(
      "border-t border-line px-4 py-[9px] font-mono text-[13.5px] font-medium text-ink",
      opts.isBest && "shadow-[inset_3px_0_0_var(--color-best)]",
      opts.chosenWrong && "shadow-[inset_3px_0_0_var(--color-blunder)]"
    ),
  // On its own line below md, so neither the move nor the tag breaks.
  optionTag:
    "whitespace-nowrap font-sans text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-faint max-md:mt-1 max-md:block md:ml-2.5",
  // Function, 1 param -> passed directly. The loss; Blunder's ink on the
  // chosen wrong row.
  optionLoss: (chosenWrong: boolean): string =>
    clsx(
      "border-t border-line px-4 py-[9px] text-right font-mono text-[13.5px] font-medium tabular-nums",
      chosenWrong ? "text-blunder-ink" : "text-ink-muted"
    ),
  // The cube equities, in the same card under the options.
  equities: "grid grid-cols-3 border-t border-line",
  equityCell: "flex flex-col gap-0.5 px-4 py-2.5 [&+&]:border-l [&+&]:border-line",
  equityLabel: "text-[11.5px] text-ink-faint",
  equityValue: "font-mono text-[15px] font-medium text-ink",

  // Sticky at the bottom of the screen below md, so rating never needs a
  // scroll, on a solid band (paper at 95%, blurred) so the options don't
  // show through the gaps between the buttons.
  grade:
    "z-10 grid grid-cols-3 gap-2 max-md:sticky max-md:bottom-0 max-md:-mx-4 max-md:border-t max-md:border-line max-md:bg-paper/95 max-md:px-4 max-md:py-3 max-md:backdrop-blur",
  // Function, 1 param (options object). `primary`: Good, and Next card;
  // `wide`: spans the row (after a wrong answer).
  gradeButton: (opts: { primary: boolean; wide: boolean }): string =>
    clsx(
      "flex flex-col items-center gap-1 rounded-[11px] border px-1.5 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-45",
      opts.primary
        ? "border-primary bg-primary text-on-primary hover:bg-primary/86"
        : "border-line-strong bg-surface text-ink hover:bg-sunken",
      opts.wide && "col-span-3"
    ),
  gradeLabel: "text-[13.5px] font-semibold",
  // Function, 1 param -> passed directly. The key line under the label.
  gradeKey: (onPrimary: boolean): string =>
    clsx("font-mono text-[10.5px] font-medium", onPrimary ? "text-on-primary/70" : "text-ink-faint"),
  linkRow: "flex flex-wrap gap-[18px]",
  retryButton: shared.buttonPrimary,
  mutedText: clsx(shared.mutedText, "px-4 md:px-0"),
  errorText: shared.errorText,
  doneBox: clsx(shared.card, "mx-3 flex flex-col gap-4 p-6 md:mx-0"),
  doneTitle: "font-serif text-title font-display text-ink",
} as const;
