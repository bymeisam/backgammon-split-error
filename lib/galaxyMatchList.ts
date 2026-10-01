// Pure logic behind /galaxy/matches' match table: row order and each row's
// Sync button state.
import type { MatchAnalysis } from "@/lib/analysesTypes";

// A per-match Sync click's progress, held in the page for this session.
export type SyncState =
  | { status: "syncing" }
  | { status: "synced" }
  | { status: "error"; message: string };

// Galaxy's analyses/list returns each page sorted ascending by matchId
// (oldest-in-page first), and the response has no play-timestamp field to
// sort by instead — matchId descending is the best available proxy for
// "most recent first" within a page. Doesn't mutate its input.
export function sortNewestFirst(analyses: MatchAnalysis[]): MatchAnalysis[] {
  return [...analyses].sort((a, b) => b.matchId - a.matchId);
}

// What the sync route's (already OK) JSON body means. A 200 only says the
// sync ran: if it ingested nothing *and* reported errors, that's a real
// failure (e.g. a bad/expired token), not a success with an empty match —
// surfaced as the first error. A non-OK response never gets here
// (jsonOrThrow throws first).
export function interpretSyncResponse(json: unknown): SyncState {
  const { gamesIngested, errors } = (json ?? {}) as { gamesIngested?: unknown; errors?: unknown };
  if (gamesIngested === 0 && Array.isArray(errors) && errors.length > 0) {
    return { status: "error", message: String(errors[0]) };
  }
  return { status: "synced" };
}

// A row's state: this session's own Sync click wins; otherwise a match the
// DB already has fully ingested (doneMatchIds, from the existence check —
// sourceMatchIds as strings, matching the DB column) shows as synced even
// though nobody clicked Sync this session; otherwise none (a plain Sync
// button).
export function resolveSyncState(
  syncStates: Readonly<Record<number, SyncState>>,
  doneMatchIds: ReadonlySet<string>,
  matchId: number
): SyncState | undefined {
  if (Object.hasOwn(syncStates, matchId)) return syncStates[matchId];
  return doneMatchIds.has(String(matchId)) ? { status: "synced" } : undefined;
}
