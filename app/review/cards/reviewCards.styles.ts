import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers
// ReviewCardsPage (page.tsx) and CardActions.tsx (same folder, only used
// here). The filter dropdowns and pagination are shared components with
// their own styles.
// The page container, width, breadcrumbs and title are PageShell's.
export const style = {
  link: "underline hover:text-black dark:hover:text-zinc-100",
  form: "flex flex-wrap items-end gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-zinc-900",
  applyButton:
    "rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-black hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
  mutedText: "text-sm text-zinc-600 dark:text-zinc-400",
  tableWrapper: "overflow-x-auto rounded-lg border border-black/10 bg-white dark:border-white/15 dark:bg-zinc-900",
  table: "w-full text-sm",
  headCell: "border-b border-black/10 px-3 py-2 text-left text-xs font-medium text-zinc-500 dark:border-white/15 dark:text-zinc-400",
  // Function, 1 param -> passed directly. Suspended rows are dimmed.
  row: (suspended: boolean): string =>
    clsx("border-b border-black/5 last:border-0 dark:border-white/10", suspended && "opacity-60"),
  cell: "px-3 py-2 align-top text-black dark:text-zinc-100",
  monoCell: "px-3 py-2 align-top font-mono text-black dark:text-zinc-100",
  numCell: "px-3 py-2 text-right align-top font-mono text-black dark:text-zinc-100",
  positionText: "font-mono text-xs",
  positionLink: "text-xs text-zinc-500 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100",
  tagChip:
    "mr-1 inline-flex rounded-full border border-black/10 bg-zinc-100 px-2 py-0.5 text-xs dark:border-white/15 dark:bg-zinc-800",
  stateText: "text-xs text-zinc-500 dark:text-zinc-400",
  actions: "flex flex-wrap gap-2",
  actionButton:
    "rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-black hover:bg-zinc-100 disabled:opacity-40 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
  deleteButton:
    "rounded-full border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950",
  errorText: "text-xs text-red-600 dark:text-red-400",
  modalOverlay: shared.modalOverlay,
  modalPanel: shared.modalPanel,
  modalHeading: shared.modalHeading,
  modalText: shared.modalText,
  modalButtons: shared.modalButtons,
  modalPrimaryButton: shared.modalPrimaryButton,
  modalSecondaryButton: shared.modalSecondaryButton,
} as const;
