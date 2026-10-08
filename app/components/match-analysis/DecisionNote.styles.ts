import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers DecisionNote.tsx, the note card below every board and on the back
// of a review card. Notes are set in the serif, like annotations in a book.
export const style = {
  // Function, 2 params -> passed directly. The review back's card is a
  // little tighter (its mockup), the board pages' a little roomier; `inset`
  // keeps it off the screen edge on a page without side padding below md.
  card: (compact: boolean, inset: boolean): string =>
    clsx(
      shared.card,
      compact ? "flex flex-col gap-2 px-4 py-3.5" : "flex flex-col gap-2.5 px-[18px] py-4",
      inset && "mx-3 md:mx-0"
    ),
  head: "flex min-h-[34px] items-center justify-between gap-3",
  label: shared.overline,
  textarea: clsx(
    "min-h-[84px] w-full resize-y rounded-[9px] border border-line bg-paper px-3 py-2.5 font-serif text-[14.5px] leading-[1.55] text-ink placeholder:italic placeholder:text-ink-faint",
    shared.focusRingInset
  ),
  readOnlyText: "whitespace-pre-wrap font-serif text-base leading-[1.55] text-ink",
  emptyText: "font-serif text-base italic leading-[1.55] text-ink-faint",
  foot: "flex flex-wrap items-center justify-between gap-2.5",
  tags: "min-w-0",
  footEnd: "ml-auto flex items-center gap-2.5",
  saveButton: shared.buttonCompact,
  editButton: shared.textButton,

  // Function, 1 param -> passed directly. Saving/saved are muted; an error
  // is red.
  status: (isError: boolean): string => clsx("text-xs", isError ? "text-blunder-ink" : "text-ink-faint"),
} as const;
