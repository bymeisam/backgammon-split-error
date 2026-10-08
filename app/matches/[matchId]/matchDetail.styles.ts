import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — MatchAnalysis.tsx
// is the only component defined in this route folder. The page container,
// breadcrumbs and header are PageShell's ("detail" variant, like the
// replay's).
export const style = {
  // Loading / error / not-ingested messages, under the header.
  statusBlock: "flex w-full max-w-2xl flex-col gap-2 px-4 md:px-0",
  loadingText: shared.mutedText,
  errorBox: shared.errorBox,
  notIngestedBox: shared.infoBox,

  // "View on Galaxy" — opens the match on Galaxy's site in a new tab.
  externalLink: shared.textLink,
} as const;
