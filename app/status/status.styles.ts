// Page-local (see .claude/skills/styling-conventions) — covers StatusPage
// and its exclusive subcomponent Row (same file).
export const style = {
  rowWrapper:
    "flex items-center justify-between border-b border-black/5 py-2 text-sm last:border-b-0 dark:border-white/10",
  rowLabel: "text-zinc-500 dark:text-zinc-400",
  rowValue: "font-mono text-black dark:text-zinc-100",

  // (The page container, width and title are PageShell's.)

  // Shared by all 3 sections (Stack/Database/Notes).
  section: "rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900",
  sectionTitle:
    "mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",

  // Function, 1 param -> passed directly. A plain either/or with no shared
  // static prefix to compose, so no clsx needed here — every letter of
  // both branches differs, there's nothing to join.
  connectionStatus: (connected: boolean): string =>
    connected ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",

  notesList: "list-disc space-y-1.5 pl-5 text-sm text-black dark:text-zinc-100",
} as const;
