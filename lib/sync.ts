// Shared multi-match sync: walks the full analyses/list index (upserting
// Match rows, never touching ingestStatus), then detail-ingests every match
// that isn't already DONE, sequentially, one at a time. Used by both the
// unbounded local scripts (scripts/backfill.ts, scripts/incremental-sync.ts)
// and the capped Vercel route (app/api/sync/incremental/route.ts) — the cap
// itself is the only thing that differs between entry points; this function
// has no idea which one is calling it.
import { prisma } from "@/lib/prisma";
import { createGalaxyClient } from "@/lib/galaxy-client";
import { ingestMatch, type MatchIndexData } from "@/lib/ingest";
import { appendSyncErrorLog } from "@/lib/errorLog";

const SOURCE = "galaxy";

// Re-attempted alongside PENDING/FAILED: a match stuck here means a
// previous run crashed mid-ingest without reaching FAILED.
const NEEDS_INGEST_STATUSES = ["PENDING", "INGESTING", "FAILED"] as const;

// A single Prisma validation error can itself run several KB (it pretty-
// prints the whole query args); ingestMatch's per-event errors get joined
// with "; " into one message, so a match with many failed events can easily
// produce a message hundreds of KB long. The full, untruncated version
// (stack included) always goes to logs/sync-errors.log via
// appendSyncErrorLog. This bounded version is for console/DB only — writing
// something that large into Match.ingestError (a MySQL TEXT column, 64KB
// max) or the SyncRun.errors JSON column can itself throw and crash the
// whole run, which is exactly what happened before this fix (match
// 32699544: a ~480KB joined message overflowed ingestError's TEXT limit,
// and that throw wasn't caught by anything, killing the whole backfill).
const MAX_SHORT_ERROR_LENGTH = 500;

function summarizeError(message: string): string {
  const flattened = message.replace(/\s+/g, " ").trim();
  return flattened.length > MAX_SHORT_ERROR_LENGTH
    ? `${flattened.slice(0, MAX_SHORT_ERROR_LENGTH)}... (truncated — full detail in logs/sync-errors.log)`
    : flattened;
}

export type SyncType = "BACKFILL" | "INCREMENTAL";

export interface SyncRunOptions {
  token: string;
  type: SyncType;
  maxMatchesToProcess?: number;
}

export interface SyncRunError {
  matchId: number;
  error: string;
}

export interface SyncRunResult {
  syncRunId: number;
  type: SyncType;
  startedAt: Date;
  finishedAt: Date;
  matchesFound: number;
  matchesProcessed: number;
  matchesSynced: number;
  matchesFailed: number;
  // Matches present in the index whose ingestStatus was already DONE before
  // this run started — never entered the detail-ingest loop below, so
  // matchesProcessed/matchesSynced/matchesFailed say nothing about them.
  detailAlreadyDone: number;
  stillPending: number;
  errors: SyncRunError[];
}

export async function runSync({
  token,
  type,
  maxMatchesToProcess,
}: SyncRunOptions): Promise<SyncRunResult> {
  const syncRun = await prisma.syncRun.create({
    data: { type, startedAt: new Date() },
  });

  const client = createGalaxyClient(token);
  const errors: SyncRunError[] = [];

  // --- Step 1: index-sync. Walk every analyses/list page, upserting index
  // fields for every match seen. New matches default to ingestStatus:
  // PENDING (schema default) on create; existing matches' ingestStatus is
  // never touched here — only the detail-ingest step below changes it.
  let matchesFound = 0;
  let page = 1;
  let totalPages = 1;

  do {
    const listResponse = await client.listMatches(page);
    totalPages = listResponse.totalPages;

    // Same upsert as app/api/galaxy/matches/list/[page]/route.ts, done here
    // too so the CLI/script path (which never hits that route) also
    // establishes "you" before detail-ingest runs below — ingestMatch's
    // opponent-identity resolution depends on this row already existing to
    // tell "you" apart from the opponent in a match's own userIds.
    try {
      await prisma.playerIdentity.upsert({
        where: { source_sourceUserId: { source: SOURCE, sourceUserId: listResponse.userId } },
        create: { source: SOURCE, sourceUserId: listResponse.userId, displayName: listResponse.userName },
        update: { displayName: listResponse.userName },
      });
    } catch (e) {
      console.error("Failed to upsert PlayerIdentity (you):", e);
    }

    for (const m of listResponse.analyses) {
      const indexData: MatchIndexData = {
        opponentName: m.opponentName,
        opponentCountry: m.opponentCountry,
        opponentRating: m.opponentRating,
        opponentError: m.opponentError,
        opponentScore: m.opponentScore,
        userError: m.userError,
        userRating: m.userRating,
        userScore: m.userScore,
      };

      await prisma.match.upsert({
        where: { source_sourceMatchId: { source: SOURCE, sourceMatchId: String(m.matchId) } },
        create: { source: SOURCE, sourceMatchId: String(m.matchId), ...indexData },
        update: indexData,
      });

      matchesFound++;
    }

    page++;
  } while (page <= totalPages);

  // --- Step 2: detail-ingest. Matches already DONE are never touched here
  // — no Galaxy call is made for them — which is what makes reruns cheap.
  // detailAlreadyDone is captured here, before the loop below can change any
  // status — index-sync above never touches ingestStatus, so this is exactly
  // "how many matches in the index needed no work this run."
  const detailAlreadyDone = await prisma.match.count({ where: { ingestStatus: "DONE" } });
  const toIngest = await prisma.match.findMany({
    where: { ingestStatus: { in: [...NEEDS_INGEST_STATUSES] } },
    orderBy: { id: "desc" },
  });

  let matchesProcessed = 0;
  let matchesSynced = 0;
  let matchesFailed = 0;

  for (const match of toIngest) {
    if (maxMatchesToProcess !== undefined && matchesProcessed >= maxMatchesToProcess) {
      break;
    }

    const externalMatchId = Number(match.sourceMatchId);

    // Written before any Galaxy call — this is what makes a mid-match crash
    // (stuck at INGESTING) visibly distinguishable from a never-attempted
    // match (still PENDING) on the next run.
    await prisma.match.update({
      where: { id: match.id },
      data: { ingestStatus: "INGESTING" },
    });

    try {
      const indexData: MatchIndexData = {
        opponentName: match.opponentName,
        opponentCountry: match.opponentCountry,
        opponentRating: match.opponentRating,
        opponentError: match.opponentError,
        opponentScore: match.opponentScore,
        userError: match.userError,
        userRating: match.userRating,
        userScore: match.userScore,
      };

      const summary = await ingestMatch(externalMatchId, indexData, token);

      // One line per match accounting for every event encountered: ingested
      // decisions, events skipped only because count_as_decision was false
      // (still upserted — see IngestSummary), and events with no review at
      // all. Unconfirmed analysed_event/event_type cases are logged
      // separately by ingestMatch itself as they're encountered.
      console.log(
        `match ${externalMatchId}: ${summary.gamesIngested} games, ${summary.decisionsIngested} decisions upserted, ${summary.decisionsSkippedNotCounted} not-counted, ${summary.eventsSkippedNoReview} no-review`
      );

      if (summary.errors.length > 0) {
        throw new Error(summary.errors.join("; "));
      }

      await prisma.match.update({
        where: { id: match.id },
        data: { ingestStatus: "DONE", ingestError: null },
      });
      matchesSynced++;
    } catch (e) {
      const fullMessage = e instanceof Error ? e.message : "Unknown error";
      const stack = e instanceof Error ? e.stack : undefined;
      const shortMessage = summarizeError(fullMessage);

      // Printed immediately (not just accumulated for the final summary) so
      // a long run's failures are visible as they happen, not only once the
      // whole thing finishes. Kept short and console-only on purpose — the
      // full detail (stack trace included, untruncated) goes to
      // logs/sync-errors.log instead, so terminal scrollback truncation
      // never loses anything.
      console.error(`match ${externalMatchId} FAILED: ${shortMessage}`);

      // The failure-handling path itself must not be able to crash the run
      // either — that's the whole point of this catch block. Wrapped
      // separately so a logging/DB problem here (a dropped connection, for
      // instance) is reported and skipped rather than propagating past this
      // match, the same way ingestMatch's own per-event try/catch already
      // stops one bad event from taking down its match.
      try {
        await appendSyncErrorLog({ matchId: externalMatchId, message: fullMessage, stack });
        await prisma.match.update({
          where: { id: match.id },
          data: { ingestStatus: "FAILED", ingestError: shortMessage },
        });
      } catch (loggingError) {
        console.error(
          `match ${externalMatchId}: failed to record failure detail: ${loggingError instanceof Error ? loggingError.message : "unknown error"}`
        );
      }

      matchesFailed++;
      errors.push({ matchId: externalMatchId, error: shortMessage });
      // Deliberately no rethrow — one match's failure must not stop the loop.
    }

    matchesProcessed++;
  }

  const stillPending = await prisma.match.count({
    where: { ingestStatus: { in: [...NEEDS_INGEST_STATUSES] } },
  });

  const finishedAt = new Date();
  await prisma.syncRun.update({
    where: { id: syncRun.id },
    data: {
      finishedAt,
      matchesFound,
      matchesSynced,
      matchesFailed,
      // Round-trip through JSON so the value is a plain JSON-compatible
      // object, matching what Prisma's Json column input expects.
      errors: errors.length > 0 ? JSON.parse(JSON.stringify(errors)) : undefined,
    },
  });

  return {
    syncRunId: syncRun.id,
    type,
    startedAt: syncRun.startedAt,
    finishedAt,
    matchesFound,
    matchesProcessed,
    matchesSynced,
    matchesFailed,
    detailAlreadyDone,
    stillPending,
    errors,
  };
}
