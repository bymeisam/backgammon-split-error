import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Shared/promoted component (see .claude/skills/styling-conventions) —
// covers DecisionListWithDetail.tsx and its exclusive subcomponent
// DecisionCard.tsx (used only by DecisionListWithDetail, same folder). The
// list card's markup is DecisionList.styles.ts's.
export const style = {
  // DecisionListWithDetail's own markup: the replay layout.
  emptyStateText: shared.mutedText,
  layout: "grid grid-cols-1 items-start gap-6 min-[980px]:grid-cols-[minmax(0,1fr)_380px]",
  cardColumn: "min-w-0",
  listWrapper: "flex min-w-0 flex-col min-[980px]:sticky min-[980px]:top-[76px] min-[980px]:max-h-[calc(100vh-96px)]",
  loss: "font-mono text-xs tabular-nums text-ink-muted",

  // DecisionCard.tsx's own markup: not a card — a context line, then the
  // board, the Played/Best chips and the note card.
  card: "flex flex-col gap-3",
  contextLine: "flex flex-wrap items-center gap-2 text-[12.5px] text-ink-faint",
  contextStrong: "font-semibold tabular-nums text-ink",
  contextLinks: "ml-auto flex flex-wrap items-center gap-4",
  // Shared by "View match" and "View on Galaxy".
  cardMatchLink: clsx(shared.textLink, "text-[12.5px]"),
} as const;
