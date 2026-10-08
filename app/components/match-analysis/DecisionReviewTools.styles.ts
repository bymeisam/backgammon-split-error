import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers DecisionReviewTools.tsx, rendered by BoardPanel.tsx below the note
// on every DB-backed page that shows a board. Same card look as
// DecisionNote.
export const style = {
  card: clsx(shared.card, "flex flex-col gap-3 p-4"),
  reviewRow: "flex flex-wrap items-center gap-2 text-sm",
  addButton: shared.buttonPrimary,
  inReview:
    "inline-flex items-center gap-1.5 rounded-full border border-line bg-sunken px-2.5 py-1 text-xs font-medium text-ink-muted underline-offset-4 before:h-1.5 before:w-1.5 before:rounded-full before:bg-accent hover:text-ink hover:underline",
  error: "text-xs text-blunder-ink",
} as const;
