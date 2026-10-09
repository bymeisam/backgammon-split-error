// The data sources the app syncs matches from, one card each on /sources
// (write mode only; proxy.ts 404s /sources otherwise). Today that's Galaxy
// alone; another source (e.g. an XG import) adds an entry here, plus its own
// actions component in app/sources/page.tsx's SOURCE_ACTIONS if it has any.
//
// Server only: a status getter may query the database (read-only client).
import { latestFinishedSyncRun } from "@/lib/dashboardQueries";
import { lastSyncedParts } from "@/lib/dashboardStats";

export interface SourceLink {
  label: string;
  href: string;
}

// One line of status on the card: an overline label and its value, with an
// optional tooltip (e.g. the exact time).
export interface SourceStatus {
  label: string;
  value: string;
  title?: string;
}

export interface Source {
  // Also the card's element id, so "/sources#<id>" links to it.
  id: string;
  label: string;
  description: string;
  links: SourceLink[];
  status: (now: Date) => Promise<SourceStatus>;
}

// "Synced 4 days ago · 28 matches" from the latest finished SyncRun (the
// same query and wording the navbar's sync line used). A DB error reads
// "Last sync unknown" instead of failing the page.
export async function galaxyStatus(now: Date): Promise<SourceStatus> {
  try {
    const run = await latestFinishedSyncRun();
    const { when, count } = lastSyncedParts(run, now);
    return {
      label: "Last synced",
      value: when + count,
      title: run ? run.finishedAt.toLocaleString() : undefined,
    };
  } catch (error) {
    console.error("[sources] last sync lookup failed:", error);
    return { label: "Last synced", value: "Last sync unknown" };
  }
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
