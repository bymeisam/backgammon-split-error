import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers Badge.tsx, the generic compact-badge primitive ClassificationBadge/
// SeverityBadge build on top of.
export const style = {
  // Function, 2 params -> passed directly, matching Badge's own two
  // variable inputs (config.color, and the className prop a caller can use
  // to extend it). A config colour is a severity: a filled sans chip. No
  // colour is a classification code: outlined mono (shared.codeChip).
  badge: (color: string | undefined, className: string): string =>
    clsx(color ? clsx(shared.severityChipShape, color) : shared.codeChip, className),
} as const;
