// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers FilterSelect.tsx (FilterSelect + FilterSelectFallback), the GET-form
// filter dropdowns used by /mistakes and /repeated-positions.
export const style = {
  field: "flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400",
  select:
    "rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm text-black dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-100",
  disabledSelect:
    "rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm text-zinc-400 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-500",
} as const;
