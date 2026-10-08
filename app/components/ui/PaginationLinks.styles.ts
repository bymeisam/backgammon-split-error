import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers PaginationLinks.tsx, the Prev / "Page N of M" / Next row used by
// /mistakes and /repeated-positions.
export const style = {
  row: "flex items-center justify-between",
  pageIndicator: "text-[13px] tabular-nums text-ink-muted",

  // Function, 1 param -> passed directly. Shared by the Prev and Next
  // links, differing only in which boolean disables them.
  link: (isDisabled: boolean): string =>
    clsx(shared.buttonSecondary, isDisabled && "pointer-events-none opacity-40"),
} as const;
