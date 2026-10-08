import clsx from "clsx";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers PaginationLinks.tsx, the Prev / "Page N of M" / Next row used by
// /mistakes and /repeated-positions.
export const style = {
  row: "flex items-center justify-between",
  pageIndicator: "text-[13px] tabular-nums text-ink-muted",

  // Function, 1 param -> passed directly. Added to the Prev and Next
  // links (Button's secondary look): a link can't be `disabled`, so a
  // disabled one is non-interactive and faded by hand.
  disabledLink: (isDisabled: boolean): string => clsx(isDisabled && "pointer-events-none opacity-40"),
} as const;
