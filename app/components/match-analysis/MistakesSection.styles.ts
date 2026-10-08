import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local to this shared component (see .claude/skills/styling-conventions)
// — covers MistakesSection.tsx's own markup and its exclusive subcomponents
// PRStat and MistakeTable (same file, used nowhere else). MoveDelta/Dice/
// DecisionList are shared leaves with their own styles files.
//
// `bleed` (functions below): the page has no side padding below md
// (/matches/[matchId]), so these blocks inset themselves there.
export const style = {
  mistakeTableNoRollText: "text-xs text-ink-faint",

  sectionWrapper: "flex flex-col gap-6",
  sectionTitle: shared.pageSectionTitle,
  // Function, 1 param -> passed directly.
  mutedText: (bleed: boolean): string => clsx(shared.mutedText, bleed && "px-4 md:px-0"),

  // data-testid wrapper (e2e/board-visual.spec.ts's "mistakes-section"
  // screenshot): the stat card, then the section head.
  mistakesSectionChrome: "flex flex-col gap-6",

  // Function, 1 param -> passed directly. The PR figures as one card, three
  // cells, so the board starts higher.
  statCard: (bleed: boolean): string =>
    clsx(shared.card, "grid grid-cols-3 overflow-hidden", bleed && "mx-3 md:mx-0"),
  statCell: "flex flex-col gap-2 px-3.5 py-3.5 [&+&]:border-l [&+&]:border-line sm:px-[18px]",
  statLabel: shared.overline,
  statValue: "font-serif text-[26px] font-medium leading-none tabular-nums text-ink sm:text-[30px]",
  statMeta: "text-xs text-ink-faint",

  // Function, 1 param -> passed directly. "Mistakes" with the Game select on
  // the right.
  sectionHead: (bleed: boolean): string =>
    clsx("flex items-baseline justify-between gap-4", bleed && "px-4 md:px-0"),
  gameField: "flex items-center",
  srOnly: "sr-only",
  gameSelect: shared.filterSelect,

  // The replay layout: the board column, the lists beside it from 980px.
  layout: "grid grid-cols-1 items-start gap-6 min-[980px]:grid-cols-[minmax(0,1fr)_380px]",
  boardColumn: "flex min-w-0 flex-col gap-3",
  // Function, 1 param -> passed directly. "Game 4" above the board (there's
  // no stepper here).
  contextLine: (bleed: boolean): string =>
    clsx("text-[12.5px] text-ink-faint", bleed && "px-4 md:px-0"),
  listsColumn: "flex min-w-0 flex-col gap-4",
  selectActions: "flex gap-3",
  selectButton: clsx(shared.textLink, "text-xs"),
  loss: "font-mono text-xs tabular-nums text-ink-muted",
} as const;
