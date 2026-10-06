import clsx from "clsx";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers DecisionNote.tsx, rendered by BoardPanel.tsx below the board on
// every page that shows one. Same card look as BoardPanel's own panel.
export const style = {
  card: "flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900",
  label: "text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
  textarea:
    "min-h-20 w-full resize-y rounded-lg border border-black/10 bg-zinc-50 px-3 py-2 text-sm text-black outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-white/40",
  footer: "flex items-center justify-between gap-2 text-xs",
  saveButton:
    "rounded-lg bg-black px-3 py-1.5 font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200",
  readOnlyText: "whitespace-pre-wrap text-sm text-black dark:text-zinc-50",

  // Function, 1 param -> passed directly. Saving/saved are muted; an error
  // is red.
  status: (isError: boolean): string =>
    clsx(isError ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"),
} as const;
