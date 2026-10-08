import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers TagEditor.tsx, in the note card's foot (DecisionNote) below the
// board on /mistakes, /repeated-positions, /matches/[matchId] and the
// replay, and on the back of a /review card.
export const style = {
  wrapper: "flex flex-wrap items-center gap-1.5",
  chip: shared.tagChip,
  chipRemove: "-mr-1 rounded-full px-1 leading-none text-ink-faint hover:bg-line hover:text-ink disabled:opacity-40",
  addChip: shared.tagChipAdd,
  inputWrapper: "relative inline-flex",
  input: clsx(shared.input, "h-[26px] w-36 rounded-full px-2.5 py-0 text-xs"),
  suggestions:
    "absolute left-0 top-full z-10 mt-1 flex max-h-48 min-w-44 flex-col overflow-y-auto rounded-control border border-line bg-surface py-1 shadow-raised",
  // Function, 1 param -> passed directly. The keyboard-highlighted
  // suggestion gets a background.
  suggestion: (isActive: boolean): string =>
    clsx("px-3 py-1 text-left text-sm text-ink hover:bg-sunken", isActive && "bg-sunken"),
  error: "basis-full text-xs text-blunder-ink",
} as const;
