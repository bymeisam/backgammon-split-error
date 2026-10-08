// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers Dice.tsx, the small dice in the move lists (DecisionList.tsx).
// The board draws its own dice (Board.tsx's BoardDie).
export const style = {
  rollWrapper: "inline-flex items-center gap-[3px]",
  miniFace: "fill-surface stroke-ink-muted [stroke-width:7]",
  miniPip: "fill-ink",
} as const;
