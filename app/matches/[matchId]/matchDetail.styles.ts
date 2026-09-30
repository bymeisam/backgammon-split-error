// Page-local (see .claude/skills/styling-conventions) — MatchAnalysisPage
// is the only component defined in this route folder.
export const style = {
  pageContainer: "flex flex-1 justify-center bg-zinc-50 dark:bg-black",
  main: "flex w-full max-w-7xl flex-col gap-6 px-6 py-12",
  headerBlock: "flex w-full max-w-2xl flex-col gap-2",
  title: "text-2xl font-semibold tracking-tight text-black dark:text-zinc-50",
  loadingText: "text-sm text-zinc-600 dark:text-zinc-400",
  errorBox:
    "rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  notIngestedBox:
    "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-600 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400",

  replayRow: "flex flex-wrap items-center gap-2",
  replayLabel: "text-sm text-zinc-500 dark:text-zinc-400",
  replayLink:
    "inline-flex h-8 items-center justify-center rounded-full border border-black/10 px-3 text-xs font-medium text-black transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
} as const;
