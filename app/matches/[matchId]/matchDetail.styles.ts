import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — MatchAnalysisPage
// is the only component defined in this route folder. The page container,
// width, breadcrumbs and title are PageShell's.
export const style = {
  // Loading / error / not-ingested messages, under the title.
  statusBlock: "flex w-full max-w-2xl flex-col gap-2",
  loadingText: shared.mutedText,
  errorBox: shared.errorBox,
  notIngestedBox: shared.infoBox,

  // "View on Galaxy" — opens the match on Galaxy's site in a new tab.
  externalLink: shared.textLink,

  replayRow: "flex flex-wrap items-center gap-2",
  replayLabel: shared.faintText,
  replayLink: shared.buttonSmall,
} as const;
