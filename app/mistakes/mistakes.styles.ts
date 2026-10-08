import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers
// MistakesPage and every component defined in this same page.tsx file
// (FilterSelects, DecisionListSection, DecisionListFallback), plus
// BulkAddToReview.tsx (same folder, only used here). The filter
// dropdowns and pagination row are shared components with their own styles
// (app/components/ui/FilterSelect.styles.ts, PaginationLinks.styles.ts).
// The page container, width and title are PageShell's.
export const style = {
  backLink: "underline hover:text-black dark:hover:text-zinc-100",
  form: "flex flex-wrap items-end gap-3 rounded-lg border border-black/10 bg-white p-3 dark:border-white/15 dark:bg-zinc-900",
  applyButton:
    "rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-black hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
  noFilterText: "text-sm text-zinc-500 dark:text-zinc-400",
  mutedText: "text-sm text-zinc-600 dark:text-zinc-400",
  fallbackRow: "flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400",
  countRow: "flex flex-wrap items-center justify-between gap-3",
  bulkAddButton:
    "rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium text-black hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-zinc-800",
  modalOverlay: shared.modalOverlay,
  modalPanel: shared.modalPanel,
  modalHeading: shared.modalHeading,
  modalText: shared.modalText,
  modalError: shared.modalError,
  modalButtons: shared.modalButtons,
  modalPrimaryButton: shared.modalPrimaryButton,
  modalSecondaryButton: shared.modalSecondaryButton,
  fallbackSpinner:
    "h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300",
} as const;
