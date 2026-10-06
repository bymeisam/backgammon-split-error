// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers GalaxyMismatchBadge.tsx, used independently by BoardPanel.tsx and
// MoveDelta.tsx.
export const style = {
  badge:
    "ml-1.5 inline-flex cursor-help items-center whitespace-nowrap rounded border border-zinc-300 px-1 py-px align-middle text-[10px] font-medium text-zinc-500 dark:border-zinc-600 dark:text-zinc-400",
} as const;
