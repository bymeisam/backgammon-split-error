export const style = {
  explorer: "flex flex-col gap-3",
  boardViewport: "w-full",
  // Everything under the board. On phones the forum's panel has no padding
  // (the board takes the full width), so this keeps its own inset there.
  details: "flex flex-col gap-3 px-2 sm:px-0",
  statusRow: "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3 text-sm",
  status: "text-ink-muted",
  statusComplete: "font-medium text-ink",
  statusNoMove: "font-medium text-ink-muted",
  // The move so far and the dice left: "6/2 · 6 to play".
  moveSummary: "tabular-nums text-ink-muted",
  controls: "flex flex-wrap gap-2",
  destinationGroup: "flex flex-col gap-2",
  destinationHeading: "text-sm font-medium text-ink",
  destinationList: "flex flex-wrap gap-2",
  destinationButton: "font-mono tabular-nums",
  selectedHint: "text-sm text-ink-muted",
  notation: "font-mono text-sm text-ink",
  explanation: "text-sm text-ink-muted",
} as const;
