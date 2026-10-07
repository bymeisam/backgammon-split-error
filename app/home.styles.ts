// Page-local (see .claude/skills/styling-conventions) — covers Home and
// DueCount, the components defined in this file. No conditional classes —
// every entry here is a plain string.
export const style = {
  pageContainer: "flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black",
  main: "flex w-full max-w-xl flex-col gap-6 px-6 py-24 text-center",
  title: "text-3xl font-semibold tracking-tight text-black dark:text-zinc-50",
  subtitle: "text-lg leading-7 text-zinc-600 dark:text-zinc-400",
  buttonRow: "flex flex-wrap items-center justify-center gap-3",
  primaryButton:
    "inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]",
  secondaryButton:
    "inline-flex h-11 items-center justify-center rounded-full border border-black/10 px-6 text-base font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/[.06]",
  // The number of review cards due, inside the Review button.
  dueBadge:
    "ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white",
  statusLink:
    "text-sm text-zinc-500 underline-offset-4 hover:text-black hover:underline dark:text-zinc-400 dark:hover:text-zinc-100",
} as const;
