import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers TagEditor.tsx, used by DecisionReviewTools (below the board on
// /mistakes, /repeated-positions, /matches/[matchId] and the replay) and by
// the back of a /review card.
export const style = {
  wrapper: "flex flex-col gap-2",
  label: shared.overline,
  chipRow: "flex flex-wrap items-center gap-1.5",
  chip: "inline-flex items-center gap-1 rounded-full border border-line bg-sunken px-2.5 py-0.5 text-xs text-ink-muted",
  chipRemove: "rounded-full px-1 text-ink-faint hover:bg-line hover:text-ink disabled:opacity-40",
  inputWrapper: "relative",
  input: clsx(shared.input, "py-1.5"),
  suggestions:
    "absolute left-0 right-0 top-full z-10 mt-1 flex max-h-48 flex-col overflow-y-auto rounded-control border border-line bg-surface py-1 shadow-raised",
  // Function, 1 param -> passed directly. The keyboard-highlighted
  // suggestion gets a background.
  suggestion: (isActive: boolean): string =>
    clsx("px-3 py-1 text-left text-sm text-ink hover:bg-sunken", isActive && "bg-sunken"),
  error: "text-xs text-blunder-ink",
  emptyText: "text-xs text-ink-faint",
} as const;
