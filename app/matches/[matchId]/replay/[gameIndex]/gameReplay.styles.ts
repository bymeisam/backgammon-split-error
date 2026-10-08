import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers page.tsx and
// GameReplay.tsx, the only components in this route folder. The list card's
// markup is DecisionList.styles.ts's; the page container, breadcrumbs and
// header are PageShell's (its "detail" variant).
export const style = {
  // Shared by both header links ("Back to match", "View on Galaxy").
  backLink: shared.textLink,
  headLinks: "flex gap-[18px]",
  notFoundBox: shared.infoBox,

  // GameReplay.tsx: the board column and the move list, side by side from
  // 980px.
  layout: "grid grid-cols-1 items-start gap-6 min-[980px]:grid-cols-[minmax(0,1fr)_380px]",
  boardColumn: "flex min-w-0 flex-col gap-4",
  emptyState: clsx(shared.mutedText, "px-4 md:px-0"),

  // The stepper, in BoardPanel's belowBoard slot (between the board and
  // the Played/Best chips).
  stepper: "mx-3 flex flex-wrap items-center gap-3 md:mx-0",
  stepButton: clsx(
    "inline-flex h-9 items-center gap-2 rounded-[9px] border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:bg-sunken",
    "disabled:cursor-not-allowed disabled:opacity-40"
  ),
  kbd: shared.kbd,
  where: "text-[13px] tabular-nums text-ink-muted",
  whereStrong: "font-semibold text-ink",
  perspectiveToggle: "ml-auto hidden items-center gap-2 text-[12.5px] text-ink-muted md:flex",
} as const;
