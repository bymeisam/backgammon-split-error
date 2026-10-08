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
  noFilterText: shared.faintText,
  mutedText: shared.mutedText,
  fallbackRow: "flex items-center gap-2 text-sm text-ink-faint",
  // The result line ("39,028 checker blunders", "Add all to review" on the
  // right) and the list under it.
  resultGroup: shared.resultGroup,
  countRow: shared.resultRow,
  resultText: "tabular-nums",
  bulkAddButton: shared.buttonSecondary,
  modalHeading: shared.modalHeading,
  modalText: shared.modalText,
  modalError: shared.modalError,
  modalButtons: shared.modalButtons,
  modalPrimaryButton: shared.modalPrimaryButton,
  modalSecondaryButton: shared.modalSecondaryButton,
  fallbackSpinner: shared.spinner,
} as const;
