import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers Pager.tsx, the Prev / "Page N of M" / Next button row on the two
// client-side match lists (/matches, /galaxy/matches).
export const style = {
  row: "flex items-center justify-between",
  pageIndicator: "text-[13px] tabular-nums text-ink-muted",
  // The disabled look comes from shared's disabled:opacity-40 plus the
  // HTML `disabled` attribute.
  button: shared.buttonSecondary,
} as const;
