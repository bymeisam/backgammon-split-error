import clsx from "clsx";
import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers StatusPage
// and its exclusive subcomponent Row (same file). The page container, width
// and title are PageShell's.
export const style = {
  rowWrapper: "flex items-center justify-between gap-4 border-t border-line py-2.5 text-[13.5px]",
  rowLabel: "text-ink-muted",
  // Function, 1 param -> passed directly. Counts in sans with tabular
  // figures; versions and migration names are IDs, so mono.
  rowValue: (numeric: boolean): string =>
    clsx("text-right text-ink", numeric ? "tabular-nums" : "font-mono text-[13px]"),

  // Shared by all 3 sections (Stack/Database/Notes).
  section: clsx(shared.card, "p-5"),
  sectionTitle: clsx(shared.overline, "mb-2"),

  // Function, 1 param -> passed directly.
  connectionStatus: (connected: boolean): string => (connected ? "text-best-ink" : "text-blunder-ink"),

  notesList: "list-disc space-y-1.5 pl-5 text-sm text-ink",
} as const;
