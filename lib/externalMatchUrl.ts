// The one place that decides whether a match has a page on its source
// platform, and what its URL is. Galaxy only: its review page is
// match-level, with no game or move parameter
// (reports/2026-10-07-galaxy-client-comparison.md, "New facts"). Any other
// source (e.g. a future XG import) gets null, so no "View on …" link.
export const GALAXY_SOURCE = "galaxy";

const GALAXY_MATCH_URL = "https://www.backgammongalaxy.com/play/page_analysis_match_details";

export function externalMatchUrl(source: string, sourceMatchId: string): string | null {
  if (source !== GALAXY_SOURCE || sourceMatchId === "") return null;
  return `${GALAXY_MATCH_URL}?match_id=${encodeURIComponent(sourceMatchId)}`;
}
