// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers Pager.tsx, the Prev / "Page N of M" / Next button row on the two
// client-side match lists (/matches, /galaxy/matches). The buttons are
// Button's secondary look (disabled: the HTML `disabled` attribute and the
// shared disabled:opacity-40).
export const style = {
  row: "flex items-center justify-between",
  pageIndicator: "text-[13px] tabular-nums text-ink-muted",
} as const;
