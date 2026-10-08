import clsx from "clsx";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers Badge.tsx, the generic compact-badge primitive ClassificationBadge/
// SeverityBadge build on top of.
export const style = {
  // Function, 2 params -> passed directly, matching Badge's own two
  // variable inputs (config.color, and the className prop a caller can use
  // to extend it).
  badge: (color: string | undefined, className: string): string =>
    clsx(
      "inline-flex items-center justify-center rounded-chip border px-1.5 py-1 text-[10.5px] font-semibold leading-none",
      // A config color sets its own border (the severity badges are filled
      // chips, lib/styles/shared.styles.ts's severityChip); the neutral
      // default is outlined.
      color ?? "border-line-strong text-ink-muted",
      className
    ),
} as const;
