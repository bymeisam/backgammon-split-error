// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers Breadcrumbs.tsx (rendered by PageShell on the deep pages).
export const style = {
  list: "flex flex-wrap items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400",
  item: "flex items-center gap-1.5",
  separator: "text-zinc-400 dark:text-zinc-600",
  link: "underline-offset-4 hover:text-black hover:underline dark:hover:text-zinc-100",
  current: "font-medium text-zinc-700 dark:text-zinc-300",
} as const;
