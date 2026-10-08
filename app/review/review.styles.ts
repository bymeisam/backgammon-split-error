import clsx from "clsx";

// Page-local (see .claude/skills/styling-conventions) — covers ReviewPage
// (page.tsx) and ReviewSession.tsx, which lives in this same folder and is
// only used here. BoardPanel, DecisionNote and TagEditor are shared
// components with their own styles.
// The page container, width and title are PageShell's.
export const style = {
  link: "underline hover:text-black dark:hover:text-zinc-100",
  form: "flex flex-wrap items-end gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-zinc-900",
  applyButton:
    "rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-black hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
  readOnlyBox:
    "rounded-lg border border-black/10 bg-white p-4 text-sm text-zinc-700 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-300",

  // --- ReviewSession.tsx ---
  sessionHeader:
    "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-black/10 bg-white px-4 py-2 text-sm dark:border-white/15 dark:bg-zinc-900",
  countNew: "font-medium text-blue-700 dark:text-blue-300",
  countReview: "font-medium text-green-700 dark:text-green-300",
  countRemaining: "text-zinc-500 dark:text-zinc-400",
  layout: "flex flex-col gap-6 lg:flex-row lg:items-start",
  boardColumn: "flex flex-col gap-3 lg:w-[640px] lg:shrink-0",
  sideColumn: "flex flex-1 flex-col gap-4 lg:min-w-0",
  contextLine: "text-xs text-zinc-500 dark:text-zinc-400",
  question: "text-xl font-semibold text-black dark:text-zinc-50",
  optionList: "flex flex-col gap-2",
  optionButton:
    "rounded-lg border border-black/10 bg-white px-4 py-2 text-left font-mono text-sm font-semibold text-black transition-colors hover:border-black/30 hover:bg-zinc-50 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:border-white/40 dark:hover:bg-zinc-800",
  optionKeyHint: "mr-2 font-sans text-xs font-normal text-zinc-400",

  // Function, 1 param -> passed directly. "Correct" green, "Incorrect" red.
  verdict: (correct: boolean): string =>
    clsx(
      "rounded-lg border px-4 py-2 text-lg font-semibold",
      correct
        ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
        : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
    ),
  summaryGrid: "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm",
  summaryLabel: "text-zinc-500 dark:text-zinc-400",
  summaryValue: "font-mono font-semibold text-black dark:text-zinc-50",
  card: "flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900",
  cardLabel: "text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
  table: "w-full text-sm",
  tableHeadCell: "pb-1 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400",
  tableHeadCellRight: "pb-1 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400",
  tableCellRight: "py-1 text-right font-mono",
  // Function, 3+ params -> one options object. An option row on the back:
  // the best one green, the chosen one ringed, a wrong one muted red text.
  optionRow: (opts: { isBest: boolean; isChosen: boolean; correct: boolean }): string =>
    clsx(
      "border-t border-black/5 dark:border-white/10",
      opts.isBest && "bg-green-50 dark:bg-green-950",
      opts.isChosen && !opts.isBest && (opts.correct ? "bg-zinc-100 dark:bg-zinc-800" : "bg-red-50 dark:bg-red-950")
    ),
  optionCell: "py-1 pr-2 font-mono font-semibold",
  optionTag: "ml-2 font-sans text-[10px] font-normal uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
  linkRow: "flex flex-wrap gap-4 text-sm",
  ratingRow: "flex flex-wrap items-center gap-2",
  // Function, 1 param -> passed directly. Hard amber, Good green, Easy blue;
  // "next" the neutral dark button.
  ratingButton: (kind: "hard" | "good" | "easy" | "next"): string =>
    clsx(
      "rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40",
      kind === "hard" && "bg-amber-600 hover:bg-amber-700",
      kind === "good" && "bg-green-600 hover:bg-green-700",
      kind === "easy" && "bg-blue-600 hover:bg-blue-700",
      kind === "next" && "bg-black hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
    ),
  mutedText: "text-sm text-zinc-500 dark:text-zinc-400",
  errorText: "text-sm text-red-600 dark:text-red-400",
  doneBox: "flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-6 dark:border-white/15 dark:bg-zinc-900",
  doneTitle: "text-lg font-semibold text-black dark:text-zinc-50",
} as const;
