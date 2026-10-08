import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers ReviewPage
// (page.tsx) and ReviewSession.tsx, which lives in this same folder and is
// only used here. BoardPanel, DecisionNote and TagEditor are shared
// components with their own styles. The page container, width and title
// are PageShell's.
export const style = {
  link: shared.textLink,
  // The filter bar: no box, a row of labelled controls.
  form: shared.filterBar,
  applyButton: shared.buttonSecondary,
  readOnlyBox: clsx(shared.card, "p-5 text-sm text-ink-muted"),

  // --- ReviewSession.tsx ---
  // The counts as one quiet line, no box.
  sessionHeader: "flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] tabular-nums",
  countNew: "font-medium text-ink",
  countReview: "font-medium text-ink",
  countRemaining: "text-ink-faint",
  layout: "flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-9",
  boardColumn: "flex flex-col gap-3 lg:w-[640px] lg:shrink-0",
  sideColumn: "flex flex-1 flex-col gap-4 lg:min-w-0",
  contextLine: "text-[13px] text-ink-faint",
  question: "mt-1.5 font-serif text-[1.625rem] font-medium leading-[1.15] tracking-[-0.012em] text-ink md:text-title",
  optionList: "flex flex-col gap-2",
  optionButton: clsx(
    "flex w-full items-center gap-3.5 rounded-control border border-line bg-surface px-4 py-3 text-left font-mono text-[15px] font-medium text-ink shadow-card",
    "transition hover:-translate-y-px hover:border-ink-faint"
  ),
  // The option's number key (was zinc-400 at 2.6:1).
  optionKeyHint: clsx(shared.kbd, "inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center p-0"),

  // Function, 1 param -> passed directly. The verdict as a serif word in
  // the severity ink colour, not a coloured slab.
  verdict: (correct: boolean): string =>
    clsx(
      "border-b border-line pb-3.5 font-serif text-title font-medium italic",
      correct ? shared.severityText("best") : shared.severityText("blunder")
    ),
  summaryGrid: "grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]",
  summaryLabel: "text-ink-faint",
  summaryValue: "font-mono font-medium text-ink",
  card: clsx(shared.card, "flex flex-col gap-2 p-4"),
  cardLabel: shared.overline,
  table: "w-full text-sm",
  tableHeadCell: "pb-1.5 text-left text-xs font-medium text-ink-faint",
  tableHeadCellRight: "pb-1.5 text-right text-xs font-medium text-ink-faint",
  tableCellRight: "py-1.5 text-right font-mono tabular-nums text-ink-muted",
  // Function, 3+ params -> one options object. An option row on the back:
  // the best one tinted Best with a bar, the chosen wrong one tinted
  // Blunder, the chosen right one (not the best) on the sunken surface.
  optionRow: (opts: { isBest: boolean; isChosen: boolean; correct: boolean }): string =>
    clsx(
      "border-t border-line",
      opts.isBest && "bg-best-tint shadow-[inset_3px_0_0_var(--best)]",
      opts.isChosen &&
        !opts.isBest &&
        (opts.correct ? "bg-sunken" : "bg-blunder-tint shadow-[inset_3px_0_0_var(--blunder)]")
    ),
  optionCell: "py-1.5 pl-2 pr-2 font-mono font-medium text-ink",
  optionTag: "ml-2 font-sans text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-faint",
  linkRow: "flex flex-wrap gap-5 text-sm",
  ratingRow: "flex flex-wrap items-center gap-2",
  // Function, 1 param -> passed directly. Neutral grading: the label and its
  // key carry the meaning, not a colour ("Good" isn't green here — green is
  // Best). Good (the default, also on Enter) and Next are the primary.
  ratingButton: (kind: "hard" | "good" | "easy" | "next"): string =>
    clsx(
      kind === "good" || kind === "next" ? shared.buttonPrimary : shared.buttonSecondary,
      "h-auto min-w-24 flex-col gap-0.5 py-2"
    ),
  // The keyboard shortcut under a rating button's label.
  ratingKey: "font-mono text-[10.5px] font-normal opacity-70",
  mutedText: shared.mutedText,
  errorText: shared.errorText,
  doneBox: clsx(shared.card, "flex flex-col gap-4 p-6"),
  doneTitle: "font-serif text-title font-medium text-ink",
} as const;
