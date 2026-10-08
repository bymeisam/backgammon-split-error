import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers StatusPage
// and its exclusive subcomponent Row (same file). The page container, width
// and title are PageShell's.
export const style = {
  rowWrapper: "flex items-center justify-between gap-4 border-b border-line py-2 text-sm last:border-b-0",
  rowLabel: "text-ink-muted",
  // Versions, counts and migration names: IDs, so mono.
  rowValue: "text-right font-mono text-[13px] text-ink",

  // Shared by all 3 sections (Stack/Database/Notes).
  section: clsx(shared.card, "p-5"),
  sectionTitle: clsx(shared.overline, "mb-2"),

  // Function, 1 param -> passed directly.
  connectionStatus: (connected: boolean): string => (connected ? "text-best-ink" : "text-blunder-ink"),

  notesList: "list-disc space-y-1.5 pl-5 text-sm text-ink",
} as const;
