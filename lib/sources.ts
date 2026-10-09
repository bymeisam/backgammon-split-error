// The data sources the app syncs matches from, one card each on /sources
// (write mode only; proxy.ts 404s /sources otherwise). Today that's Galaxy
// alone; another source (e.g. an XG import) adds an entry here, plus its own
// actions component in app/sources/page.tsx's SOURCE_ACTIONS if it has any.
//
// Server only: a status getter may query the database (read-only client).
import { latestFinishedSyncRun, sourceLibrary } from "@/lib/dashboardQueries";
import { formatTimeAgo } from "@/lib/dashboardStats";
import { formatDateTime, formatMatchDate } from "@/lib/formatDate";

export interface SourceLink {
  label: string;
  href: string;
}

// One fact on the card: an overline label, its value, and an optional
// small detail line shown under it (e.g. the exact time).
export interface SourceStatusItem {
  label: string;
  value: string;
  detail?: string;
}

// The card's status facts, rendered as a <dl>.
export interface SourceStatus {
  items: SourceStatusItem[];
}

export interface Source {
  // Also the card's element id, so "/sources#<id>" links to it.
  id: string;
  label: string;
  description: string;
  links: SourceLink[];
  status: (now: Date) => Promise<SourceStatus>;
}

type SyncRunSummary = { finishedAt: Date; matchesSynced: number } | null;
type Library = { matches: number; latestPlayedAt: Date | null };

// "1 match" / "1,284 matches".
function matchCount(n: number): string {
  return `${n.toLocaleString("en-US")} match${n === 1 ? "" : "es"}`;
}

// The Galaxy card's facts, from its two lookups (each a settled result, so
// one failing never hides the other):
// - LAST SYNC: when the latest finished SyncRun ended ("4 days ago"), the
//   exact local time under it. "Never" without a run, "Unknown" when the
//   lookup failed; either way no ADDED item.
// - LAST SYNC ADDED: that run's matchesSynced (the matches fully ingested
//   in it, lib/sync.ts), or "No new matches" at 0.
// - IN LIBRARY / LATEST MATCH: the DONE matches and the latest played date
//   among them. Both hidden at 0 DONE matches or when the lookup failed;
//   LATEST MATCH alone hidden when none has a playedAt.
export function galaxyStatusItems(
  run: PromiseSettledResult<SyncRunSummary>,
  library: PromiseSettledResult<Library>,
  now: Date
): SourceStatusItem[] {
  const items: SourceStatusItem[] = [];
  if (run.status === "rejected") {
    items.push({ label: "Last sync", value: "Unknown" });
  } else if (!run.value) {
    items.push({ label: "Last sync", value: "Never" });
  } else {
    const { finishedAt, matchesSynced } = run.value;
    items.push({ label: "Last sync", value: formatTimeAgo(finishedAt, now), detail: formatDateTime(finishedAt) });
    items.push({ label: "Last sync added", value: matchesSynced === 0 ? "No new matches" : matchCount(matchesSynced) });
  }
  if (library.status === "fulfilled" && library.value.matches > 0) {
    items.push({ label: "In library", value: matchCount(library.value.matches) });
    if (library.value.latestPlayedAt) {
      items.push({ label: "Latest match", value: formatMatchDate(library.value.latestPlayedAt.toISOString()) });
    }
  }
  return items;
}

// Both lookups run in parallel on the read-only client. A DB error is
// logged and reads as above instead of failing the page.
export async function galaxyStatus(now: Date): Promise<SourceStatus> {
  const [run, library] = await Promise.allSettled([latestFinishedSyncRun(), sourceLibrary("galaxy")]);
  if (run.status === "rejected") console.error("[sources] last sync lookup failed:", run.reason);
  if (library.status === "rejected") console.error("[sources] library lookup failed:", library.reason);
  return { items: galaxyStatusItems(run, library, now) };
}

export const SOURCES: readonly Source[] = [
  {
    id: "galaxy",
    label: "Galaxy",
    description: "Your matches on Backgammon Galaxy, with Galaxy's own analysis of every move.",
    links: [{ label: "Browse matches →", href: "/sources/galaxy/matches" }],
    status: galaxyStatus,
  },
];
