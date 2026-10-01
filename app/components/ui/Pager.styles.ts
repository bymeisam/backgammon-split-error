// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers Pager.tsx, the Prev / "Page N of M" / Next button row on the two
// client-side match lists (/matches, /galaxy/matches).
export const style = {
  row: "flex items-center justify-between",
  pageIndicator: "text-sm text-zinc-600 dark:text-zinc-400",
  // Static string — the disabled look comes entirely from the
  // `disabled:opacity-40` variant plus the HTML `disabled` attribute.
  button:
    "inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-black transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
} as const;
