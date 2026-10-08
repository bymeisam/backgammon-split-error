import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers FilterSelect.tsx (FilterSelect + FilterSelectFallback), the GET-form
// filter dropdowns used by /mistakes, /repeated-positions and the review
// pages.
export const style = {
  field: shared.filterField,
  select: shared.filterSelect,
  disabledSelect: `${shared.filterSelect} text-ink-faint`,
} as const;
