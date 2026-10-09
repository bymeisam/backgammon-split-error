import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) —
// GalaxyMatchAnalysisPage is the only component defined in this route
// folder. The page container, width, breadcrumbs and title are PageShell's.
export const style = {
  // The loading status and any error, under the title.
  statusBlock: "flex w-full max-w-2xl flex-col gap-2",
  statusText: shared.mutedText,
  errorBox: shared.errorBox,
} as const;
