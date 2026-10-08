// Page-local (see .claude/skills/styling-conventions) —
// GalaxyMatchAnalysisPage is the only component defined in this route
// folder. The page container, width, breadcrumbs and title are PageShell's.
export const style = {
  // The loading status and any error, under the title.
  statusBlock: "flex w-full max-w-2xl flex-col gap-2",
  statusText: "text-sm text-zinc-600 dark:text-zinc-400",
  errorBox:
    "rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
} as const;
