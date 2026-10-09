import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers SourcesPage
// and SourceCard (page.tsx) and GalaxySourceActions.tsx, all only used by
// /sources and in this folder. The page container, width and title are
// PageShell's; the card surface is Card's.
export const style = {
  cardList: "flex flex-col gap-5",
  // On top of Card: a section's padding, its blocks stacked.
  card: "flex flex-col gap-4 p-5",
  cardHeader: "flex flex-col gap-1",
  cardTitle: shared.pageSectionTitle,
  cardDescription: shared.mutedText,
  // "Last synced" over its value.
  status: "flex flex-col gap-0.5",
  statusLabel: shared.overline,
  statusValue: "text-sm tabular-nums text-ink",

  // --- GalaxySourceActions.tsx (and the links of a source without actions) ---
  actionsBlock: "flex flex-col gap-3",
  actionsRow: "flex flex-wrap items-center gap-2",
  // Function, 1 param -> passed directly. The last sync's own result, under
  // the buttons.
  syncMessage: (ok: boolean): string => clsx("text-sm", ok ? "text-best-ink" : "text-blunder-ink"),
} as const;
