// Page-local (see .claude/skills/styling-conventions) — covers
// MatchesPage, the only component defined in this file. No conditional
// classes anywhere in the original (the Prev/Next buttons' disabled look
// comes from the static `disabled:opacity-40` Tailwind variant plus the
// HTML `disabled` attribute, not a JS-computed className) — every entry
// here is a plain string, no clsx needed.
// The page container, width and title row are PageShell's.
export const style = {
  analysisLink:
    "text-sm text-zinc-600 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100",
  // The "Loading…" text. (The "Page N of M" indicator is the shared Pager's.)
  mutedText: "text-sm text-zinc-600 dark:text-zinc-400",
  errorBox:
    "rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  tableWrapper: "overflow-x-auto rounded-lg border border-black/10 dark:border-white/15",
  table: "w-full border-collapse text-left text-sm",
  tableHeadRow:
    "border-b border-black/10 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400",
  // Shared by all 7 head cells (Match ID/Date/Opponent/Rating/Score/Your
  // error/Opponent error).
  tableHeadCell: "px-3 py-2",
  tableRow:
    "cursor-pointer border-b border-black/5 last:border-b-0 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-800/60",
  // Shared by 6 of the 7 body cells (Match ID/Date/Rating/Score/Your
  // error/Opponent error) — the monospace numeric/id/date treatment.
  tableCell: "px-3 py-2 font-mono text-xs text-black dark:text-zinc-100",
  // Opponent name is the one body cell without font-mono/text-xs.
  opponentCell: "px-3 py-2 text-black dark:text-zinc-100",
  // The Replay link's own cell — a click target inside a clickable row, so
  // it stops propagation before the row's own onClick (match navigation)
  // fires, same pattern MoveDelta.tsx already uses for the same problem.
  replayCell: "px-3 py-2",
  replayLink:
    "text-zinc-500 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100",
} as const;
