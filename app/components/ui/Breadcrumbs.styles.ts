// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers Breadcrumbs.tsx (rendered by PageShell on the deep pages).
export const style = {
  list: "flex flex-wrap items-center gap-2 text-[13px] text-ink-faint",
  item: "flex items-center gap-2",
  separator: "opacity-60",
  link: "underline-offset-4 hover:text-ink hover:underline",
  current: "text-ink-muted",
} as const;
