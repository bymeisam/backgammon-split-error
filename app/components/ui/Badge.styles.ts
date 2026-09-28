import clsx from "clsx";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers Badge.tsx, the generic compact-badge primitive ClassificationBadge/
// SeverityBadge build on top of.
export const style = {
  // Function, 2 params -> passed directly, matching Badge's own two
  // variable inputs exactly (config.color, and the className prop it
  // already accepts for a caller to extend). Neither caller in this
  // codebase currently passes a non-default className (always ""), so in
  // practice this only ever appends nothing — clsx skips the empty string
  // entirely rather than leaving the trailing space the original template
  // literal always produced when className was "" (a harmless
  // whitespace-only difference no browser distinguishes, and the correct,
  // intended clsx behavior every other converted component already relies
  // on), while still appending a real value at the end, in the same
  // position, if a caller ever does pass one.
  badge: (color: string | undefined, className: string): string =>
    clsx(
      "inline-flex items-center justify-center rounded border border-current px-1 py-0.5 font-mono text-[10px] font-semibold leading-none",
      color ?? "text-zinc-500 dark:text-zinc-400",
      className
    ),
} as const;
