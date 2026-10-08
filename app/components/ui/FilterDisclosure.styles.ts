import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers FilterDisclosure.tsx (/review, /mistakes, /repeated-positions,
// /review/cards).
export const style = {
  group: "flex items-center gap-2 text-[12.5px] text-ink-muted",
  summary: "hidden md:inline",
  // Function, 1 param -> passed directly. The pill, raised while open.
  pill: (open: boolean): string => clsx(shared.pill, open && "border-line-strong text-ink"),
  panel: "basis-full",
} as const;
