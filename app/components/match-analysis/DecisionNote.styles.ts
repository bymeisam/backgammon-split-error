import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers DecisionNote.tsx, rendered by BoardPanel.tsx below the board on
// every page that shows one. Notes are set in the serif, like annotations
// in a book.
export const style = {
  card: clsx(shared.card, "flex flex-col gap-2.5 p-4"),
  label: shared.overline,
  textarea: clsx(
    "min-h-20 w-full resize-y rounded-control border border-line bg-paper px-3 py-2 font-serif text-[15px] leading-relaxed text-ink placeholder:italic placeholder:text-ink-faint",
    shared.focusRingInset
  ),
  footer: "flex items-center justify-between gap-2 text-xs",
  saveButton: shared.buttonSecondary,
  readOnlyText: "whitespace-pre-wrap font-serif text-base leading-relaxed text-ink",

  // Function, 1 param -> passed directly. Saving/saved are muted; an error
  // is red.
  status: (isError: boolean): string => (isError ? "text-blunder-ink" : "text-ink-faint"),
} as const;
