import clsx from "clsx";

// Page-local (see .claude/skills/styling-conventions) — covers MatchesPage
// (page.tsx) and TokenModal.tsx, folded into one file since TokenModal is
// exclusively used by this page and lives in the same folder. `errorBox` is
// shared verbatim between both components (identical original string in
// both files) rather than duplicated under two keys.
export const style = {
  // --- page.tsx ---
  pageContainer: "flex flex-1 justify-center bg-zinc-50 dark:bg-black",
  main: "flex w-full max-w-4xl flex-col gap-6 px-6 py-12",
  headerRow: "flex flex-wrap items-center justify-between gap-3",
  title: "text-2xl font-semibold tracking-tight text-black dark:text-zinc-50",
  jumpForm: "flex flex-wrap items-center gap-2",
  matchIdInput:
    "w-32 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white/30",
  // Shared by "Jump to match" and "Show JSON".
  pillButton:
    "inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-black transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
  divider: "mx-1 h-5 w-px bg-black/10 dark:bg-white/15",
  gameIndexInput:
    "w-16 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white/30",
  jsonBox: "rounded-lg border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-zinc-900",
  jsonBoxHeader: "mb-2 flex items-center justify-between",
  jsonBoxLabel:
    "text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
  jsonBoxActions: "flex items-center gap-3",
  // Shared by the "Copy"/"Close" json-box buttons.
  jsonLinkButton:
    "text-xs text-zinc-500 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100",
  // Shared by the json-box "Loading…" text, the list "Loading…" text, and
  // the "Page N of M" pagination indicator.
  mutedText: "text-sm text-zinc-600 dark:text-zinc-400",
  jsonPre:
    "max-h-[60vh] overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-black dark:bg-black dark:text-zinc-100",
  tableWrapper: "overflow-x-auto rounded-lg border border-black/10 dark:border-white/15",
  table: "w-full border-collapse text-left text-sm",
  theadRow:
    "border-b border-black/10 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400",
  headCell: "px-3 py-2",
  bodyRow:
    "cursor-pointer border-b border-black/5 last:border-b-0 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-800/60",
  opponentCell: "px-3 py-2 text-black dark:text-zinc-100",
  // Shared by the rating/score/your-error/opponent-error cells.
  monoCell: "px-3 py-2 font-mono text-xs text-black dark:text-zinc-100",
  actionCell: "px-3 py-2 text-right",
  syncingLabel: "inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400",
  spinner:
    "h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300",
  syncedLabel: "text-xs font-medium text-green-600 dark:text-green-400",
  syncButton:
    "rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
  paginationRow: "flex items-center justify-between",
  // Static string — the disabled look comes entirely from the
  // `disabled:opacity-40` Tailwind variant plus the HTML `disabled`
  // attribute, never a JS-computed className. Shared by Prev and Next.
  paginationButton:
    "inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm font-medium text-black transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",

  // --- TokenModal.tsx ---
  modalOverlay: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6",
  modalPanel:
    "flex w-full max-w-lg flex-col gap-4 rounded-xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/15 dark:bg-zinc-900",
  modalHeading: "text-lg font-semibold text-black dark:text-zinc-50",
  modalSubtext: "mt-1 text-sm text-zinc-600 dark:text-zinc-400",
  tabRow:
    "inline-flex w-fit rounded-full border border-black/10 bg-zinc-50 p-1 dark:border-white/15 dark:bg-zinc-800",
  // Function, 1 param -> passed directly. Was a hand-rolled template
  // literal keyed off `mode === "curl" | "manual"`; both tab buttons call
  // this with their own `isActive` boolean.
  tabButton: (isActive: boolean): string =>
    clsx(
      "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
      isActive ? "bg-foreground text-background" : "text-zinc-600 dark:text-zinc-400"
    ),
  // Shared by the curl-command label and the authorization label.
  fieldWrapper: "flex flex-col gap-2",
  fieldLabel: "text-sm font-medium text-zinc-700 dark:text-zinc-300",
  // Shared by the curl textarea and the plain authorization input.
  textInput:
    "w-full rounded-lg border border-black/10 bg-white p-3 font-mono text-xs text-black outline-none focus:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white/30",
  // Identical original string to page.tsx's error boxes — shared, not
  // duplicated under a second key.
  errorBox:
    "rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  connectButton:
    "inline-flex h-10 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]",
} as const;
