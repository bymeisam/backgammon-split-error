import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers
// MistakesPage and every component defined in this same page.tsx file
// (FilterSelects, DecisionListSection, DecisionListFallback), plus
// BulkAddToReview.tsx (same folder, only used here). The filter
// dropdowns and pagination row are shared components with their own styles
// (app/components/ui/FilterSelect.styles.ts, PaginationLinks.styles.ts).
// The page container, width and title are PageShell's.
export const style = {
  backLink: shared.textLink,
  // The filter bar: no box, a row of labelled controls.
  form: shared.filterBar,
  applyButton: shared.buttonSecondary,
  noFilterText: shared.faintText,
  mutedText: shared.mutedText,
  fallbackRow: "flex items-center gap-2 text-sm text-ink-faint",
  countRow: "flex flex-wrap items-center justify-between gap-3",
  bulkAddButton: shared.buttonSecondary,
  modalOverlay: shared.modalOverlay,
  modalPanel: shared.modalPanel,
  modalHeading: shared.modalHeading,
  modalText: shared.modalText,
  modalError: shared.modalError,
  modalButtons: shared.modalButtons,
  modalPrimaryButton: shared.modalPrimaryButton,
  modalSecondaryButton: shared.modalSecondaryButton,
  fallbackSpinner: shared.spinner,
} as const;
