import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers Card.tsx.
export const style = {
  // Function, 1 param -> passed directly. The shared card (surface, hairline,
  // 14px radius, the card shadow) plus the caller's own padding and layout.
  card: (className: string | undefined): string => clsx(shared.card, className),
} as const;
