import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers SourcesPage
// and SourceCard (page.tsx) and GalaxySourceActions.tsx, all only used by
// /sources and in this folder. The page container, width and title are
// PageShell's; the card surface is Card's.
export const style = {
  cardList: "flex flex-col gap-5",
  // On top of Card: a section's padding; the top row, then the status.
  card: "flex flex-col gap-4 p-5",
  // Title and description on the left, the actions on the right from md;
  // stacked below md.
  cardTop: "flex flex-col gap-4 md:flex-row md:items-start md:justify-between",
  cardHeader: "flex flex-col gap-1",
  cardTitle: shared.pageSectionTitle,
  cardDescription: shared.mutedText,
  // The status facts, a <dl> under a hairline: two per row on a phone, one
  // line from sm.
  statusList: "grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 sm:flex sm:flex-wrap sm:gap-x-10",
  statusItem: "flex flex-col gap-0.5",
  statusLabel: shared.overline,
  statusValue: "text-sm tabular-nums text-ink",
  // The detail under a value (the last sync's exact time), visible rather
  // than a tooltip.
  statusDetail: "text-xs tabular-nums text-ink-faint",

  // --- GalaxySourceActions.tsx (and the links of a source without actions) ---
  // Right-aligned from md, where it sits beside the title.
  actionsBlock: "flex flex-col gap-3 md:items-end",
  actionsRow: "flex flex-wrap items-center gap-2",
  // Function, 1 param -> passed directly. The last sync's own result, under
  // the buttons: neutral on success (severity colours are for severity),
  // Blunder's ink on failure, as shared.errorBox.
  syncMessage: (ok: boolean): string => clsx("text-sm", ok ? "text-ink-muted" : "text-blunder-ink"),
} as const;
