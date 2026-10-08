import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers DecisionReviewTools.tsx, the note card's review control (rendered
// by BoardPanel.tsx below the board on every DB-backed page that shows
// one). The card itself is DecisionNote's.
export const style = {
  reviewRow: "flex flex-wrap items-center justify-end gap-2",
  addButton: shared.buttonCompactPrimary,
  inReview: shared.buttonCompact,
  srOnly: "sr-only",
  error: "text-xs text-blunder-ink",
} as const;
