import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers page.tsx and
// GameReplay.tsx, the only components in this route folder. The list's
// row/table markup is DecisionList.styles.ts's; listWrapper (the width/
// overflow sizing) stays here, caller-owned. The page container, width,
// breadcrumbs and title row are PageShell's.
export const style = {
  // Shared by both header links ("← Back to match", "View on Galaxy"), in
  // PageShell's actions slot.
  backLink: shared.textLink,
  notFoundBox: shared.infoBox,

  // GameReplay.tsx's own markup — same board+list split shape as
  // DecisionListWithDetail.styles.ts's layout/cardColumn/listWrapper.
  layout: "flex flex-col gap-6 lg:flex-row lg:items-start",
  boardColumn: "flex flex-1 flex-col gap-4 lg:min-w-0",
  emptyState: shared.mutedText,

  perspectiveToggle: "flex items-center gap-2 text-[13px] text-ink-muted",

  navRow: "flex items-center justify-between gap-3",
  // Shared by Previous/Next.
  navButton: shared.buttonSecondary,
  // "Move N of M", plus the take/pass step's double line under it.
  stepLabel: "flex flex-col items-center gap-0.5 text-center",
  positionCounter: "text-sm tabular-nums text-ink-muted",
  doubleOfferLine: "text-xs text-ink-faint",

  gameBoundaryRow: "flex justify-center",
  gameBoundaryLink: shared.textLink,

  // 400px, and the move text may wrap, so the loss column is never clipped.
  listWrapper: "flex w-full min-w-0 flex-col gap-2 lg:max-h-[80vh] lg:w-[400px] lg:shrink-0 lg:overflow-y-auto",
} as const;
