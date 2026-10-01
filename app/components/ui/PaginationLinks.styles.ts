import clsx from "clsx";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers PaginationLinks.tsx, the Prev / "Page N of M" / Next row used by
// /mistakes and /repeated-positions.
export const style = {
  row: "flex items-center justify-between",
  pageIndicator: "text-sm text-zinc-600 dark:text-zinc-400",

  // Function, 1 param -> passed directly. Shared by the Prev and Next
  // links, differing only in which boolean disables them.
  link: (isDisabled: boolean): string =>
    clsx(
      "inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-black dark:border-white/15 dark:text-zinc-100",
      isDisabled ? "pointer-events-none opacity-40" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
    ),
} as const;
