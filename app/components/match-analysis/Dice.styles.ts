// Shared/promoted component (see .claude/skills/styling-conventions) —
// used independently by Board.tsx (BoardPanel's own subcomponent) and by
// MistakesSection.tsx directly, so it isn't exclusively either one's
// subcomponent and gets its own file rather than being folded into
// BoardPanel.styles.ts.
export const style = {
  rollWrapper: "inline-flex items-center gap-1",
} as const;
