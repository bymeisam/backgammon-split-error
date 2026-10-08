import { style as shared } from "@/lib/styles/shared.styles";

// Page-local (see .claude/skills/styling-conventions) — covers
// MatchesAnalysisPage and every component defined in this same page.tsx
// file (CountLink, BreakdownTable). The page container, width and title are
// PageShell's; the table is the shared Table.
export const style = {
  countLink: "underline-offset-4 hover:text-ink hover:underline",

  // BreakdownTable (the shared Table, for both the classification and
  // category sections): its rows tint on hover, though they aren't links.
  rowHover: "hover:[&>td]:bg-sunken",

  backLink: shared.textLink,
  // Shared by both sections (classification and category breakdowns).
  section: "flex flex-col gap-3.5",
  sectionTitle: shared.pageSectionTitle,
} as const;
