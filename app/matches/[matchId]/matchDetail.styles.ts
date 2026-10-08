// Page-local (see .claude/skills/styling-conventions) — MatchAnalysisPage
// is the only component defined in this route folder. The page container,
// width, breadcrumbs and title are PageShell's.
export const style = {
  // Loading / error / not-ingested messages, under the title.
  statusBlock: "flex w-full max-w-2xl flex-col gap-2",
  loadingText: "text-sm text-zinc-600 dark:text-zinc-400",
  errorBox:
    "rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  notIngestedBox:
    "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-600 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400",

  // "View on Galaxy" — opens the match on Galaxy's site in a new tab.
  externalLink:
    "text-sm text-zinc-500 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100",

  replayRow: "flex flex-wrap items-center gap-2",
  replayLabel: "text-sm text-zinc-500 dark:text-zinc-400",
  replayLink:
    "inline-flex h-8 items-center justify-center rounded-full border border-black/10 px-3 text-xs font-medium text-black transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
} as const;
