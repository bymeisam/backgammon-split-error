import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

export const style = {
  workspace: "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start",
  boardCard: clsx(shared.card, "flex min-w-0 flex-col gap-4 p-3 sm:p-5"),
  boardHeader: "flex flex-wrap items-start justify-between gap-3",
  overline: shared.overline,
  boardTitle: shared.pageSectionTitle,
  boardDescription: "max-w-xl text-sm leading-6 text-ink-muted",
  boardWrap: "w-full",
  boardStatus: "flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-muted",
  // Each side's checker count and pip count, kept together so a pip count
  // never reads as the other side's.
  sideCounts: "flex flex-wrap gap-x-4 gap-y-1",
  counter: "tabular-nums text-ink",
  controls: "flex flex-col gap-4",
  controlCard: clsx(shared.card, "flex flex-col gap-4 p-4"),
  controlTitle: shared.overline,
  controlHint: "text-xs leading-5 text-ink-faint",
  fieldset: "flex flex-col gap-2",
  // A legend sits outside the fieldset's flex flow, so the gap doesn't reach
  // it: its own margin separates "Score" from the Bottom/Top labels below.
  legend: "mb-2 text-xs font-medium text-ink-faint",
  segmented: "grid grid-cols-2 gap-1 rounded-control bg-sunken p-[3px] ring-1 ring-inset ring-line",
  // One option in a segmented control (side, action, decision type).
  segmentOption: (selected: boolean, disabled = false): string =>
    clsx(
      "rounded-inset px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
      selected ? "bg-surface text-ink shadow-card ring-1 ring-inset ring-line-strong" : "text-ink-muted hover:text-ink",
      disabled && "cursor-not-allowed opacity-50"
    ),
  fieldGrid: "grid grid-cols-2 gap-3",
  field: shared.filterField,
  select: shared.filterSelect,
  input: shared.input,
  inputCompact: "h-[38px] w-full rounded-control border border-line-strong bg-surface px-3 text-sm tabular-nums text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
  inlineActions: "flex flex-wrap gap-2",
  status: shared.infoBox,
  error: shared.errorBox,
  valid: "text-xs text-ink-muted",
  actionButton: "flex-1",
  statList: "grid grid-cols-3 gap-2",
  stat: "flex flex-col gap-1 rounded-control border border-line bg-sunken px-2.5 py-2",
  statLabel: "text-xs text-ink-muted",
  // Mono is for numbers (notation, equities, IDs): the off counts use it, a
  // word like "Center" doesn't.
  statValue: (numeric: boolean): string => clsx("text-sm text-ink", numeric && "font-mono tabular-nums"),
  analysisList: "flex flex-col divide-y divide-line border-y border-line",
  analysisRow: "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]",
  analysisMove: "min-w-0 truncate font-mono text-ink",
  analysisEquity: "font-mono tabular-nums text-ink",
} as const;
