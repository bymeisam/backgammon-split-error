// Page-local (see .claude/skills/styling-conventions) — covers
// MatchesAnalysisPage and every component defined in this same page.tsx
// file (CountLink, BreakdownTable). No conditional classes anywhere in
// this page (no ternaries/template literals in the original) — every entry
// here is a plain string, no clsx needed.
export const style = {
  countLink: "hover:underline hover:text-black dark:hover:text-zinc-100",

  // BreakdownTable — reused unchanged for both the classification and
  // category sections (see the page's own guard: getClassificationLabel is
  // only applied when paramName === "classification" — not a styling
  // concern).
  tableWrapper: "overflow-x-auto rounded-lg border border-black/10 dark:border-white/15",
  table: "w-full border-collapse text-left text-sm",
  tableHeadRow:
    "border-b border-black/10 bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400",
  // Shared by all 5 head cells (keyHeader/Blunders/Errors/Good/Total).
  tableHeadCell: "px-3 py-2",
  tableRow: "border-b border-black/5 last:border-b-0 dark:border-white/10",
  tableKeyCell: "px-3 py-2 text-black dark:text-zinc-100",
  // Shared by all 4 numeric cells (Blunders/Errors/Good/Total) in a row.
  tableNumberCell: "px-3 py-2 font-mono text-xs text-black dark:text-zinc-100",

  // MatchesAnalysisPage's own top-level markup (the page container, width
  // and title are PageShell's).
  backLink: "underline hover:text-black dark:hover:text-zinc-100",
  // Shared by both sections (classification and category breakdowns).
  section: "flex flex-col gap-3",
  sectionTitle: "text-lg font-semibold text-black dark:text-zinc-50",
} as const;
