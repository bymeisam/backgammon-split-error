import clsx from "clsx";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers GameSwitcher.tsx (the replay header and the match page header).
export const style = {
  wrapper: "flex items-center gap-2.5",
  label: "text-[12.5px] text-ink-faint",
  track: "flex flex-wrap gap-1 rounded-[9px] bg-sunken p-[3px]",
  // Function, 1 param -> passed directly. The current game raised.
  item: (isCurrent: boolean): string =>
    clsx(
      "rounded-[7px] px-[11px] py-[5px] text-[12.5px] font-medium tabular-nums",
      isCurrent ? "bg-surface text-ink shadow-[0_1px_2px_var(--shadow-color)]" : "text-ink-muted hover:text-ink"
    ),
} as const;
