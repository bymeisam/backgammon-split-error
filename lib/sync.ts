// Shared multi-match sync: walks the analyses/list index (upserting Match
// rows, never touching ingestStatus), then detail-ingests every match that
// isn't already DONE, sequentially, one at a time. Used by both the
// unbounded local scripts (scripts/backfill.ts, scripts/incremental-sync.ts)
// and the capped Vercel route (app/api/sync/incremental/route.ts). The type
// decides how much of the index is walked (BACKFILL: every page;
// INCREMENTAL: stops after the first page whose matches are all already
// known, see step 1); the cap only limits detail-ingest.
//
// Galaxy rate limits (since 2026-10-14): when a request is still 429 after
// lib/galaxy-client.ts's retries (GalaxyRateLimitError), the run stops
// cleanly instead of failing every remaining match against the same limit:
// the match that hit it is recorded FAILED as usual, the rest are left
// untouched for the next run, the SyncRun is finished with a note, and the
// stat recomputes still run.
//
// DB-only retry (since 2026-10-14, runDbOnlySync below): step 2 alone, with
// the same SyncRun bookkeeping and recomputes, for matches taken from our DB
// instead of from the analyses/list walk (scripts/retry-failed-matches.ts).
// It makes no list request at all, which matters when Galaxy is rate
// limiting or blocking the account.
import { prisma } from "@/lib/prisma";
import { createGalaxyClient } from "@/lib/galaxy-client";
import { ingestMatch, type MatchIndexData } from "@/lib/ingest";
import { appendSyncErrorLog } from "@/lib/errorLog";
import { recomputeMistakeStats } from "@/lib/recompute-mistake-stats";
import { recomputeRepeatedPositions } from "@/lib/recompute-repeated-positions";
import { isCertVerificationError, ORACLE_CERT_FAILURE_HINT } from "@/lib/oracleCertCheck";
import { GalaxyRateLimitError } from "@/lib/galaxyRateLimit";

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
  // null for a run-level note (the rate-limit stop), not tied to one match.
  matchId: number | null;
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
  // Set when the run stopped early on a Galaxy rate limit (also the last
  // entry of errors); null for a run that went to completion.
  rateLimitNote: string | null;
}

type MatchRow = Awaited<ReturnType<typeof prisma.match.findMany>>[number];

// Deliberately the very first DB call of a run, and deliberately wrapped: if
// Oracle's pinned CA has rotated (lib/oracleCertCheck.ts — the exact failure
// this project hit 2026-10-02), EVERY DB call after it would fail the same
// way, one ~10s pool-timeout at a time, through every single pending match in
// the detail-ingest loop — slow, and each one would look like an unrelated
// per-match failure rather than one root cause. Failing immediately here,
// with a clear message, avoids both problems. If this throws for any OTHER
// reason, it propagates exactly as any other unexpected top-level failure
// already does (the CLI's own .catch, or app/api/sync/incremental/route.ts's
// try/catch -> 502).
async function firstDbCall<T>(fn: () => Promise<T>, where: string): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isCertVerificationError(error)) {
      console.error(`[sync] ${ORACLE_CERT_FAILURE_HINT}`);
      throw new Error(
        `${ORACLE_CERT_FAILURE_HINT} (failed on the very first DB call of this sync run, ${where}, before any match was attempted.)`
      );
    }
    throw error;
  }
}

export async function runSync({
  token,
  type,
  maxMatchesToProcess,
}: SyncRunOptions): Promise<SyncRunResult> {
  // The first DB call (see firstDbCall).
  const syncRun = await firstDbCall(
    () => prisma.syncRun.create({ data: { type, startedAt: new Date() } }),
    "creating the SyncRun"
  );

  const client = createGalaxyClient(token);
  const errors: SyncRunError[] = [];

  let rateLimitNote: string | null = null;

  // --- Step 1: index-sync. Walk the analyses/list pages, upserting index
  // fields for every match seen. New matches default to ingestStatus:
  // PENDING (schema default) on create; existing matches' ingestStatus is
  // never touched here — only the detail-ingest step below changes it.
  //
  // Page 1 holds the newest matches (pages are newest-first; within a page
  // Galaxy sorts ascending by matchId, see lib/galaxyMatchList.ts). Checked
  // 2026-10-14 against the local DB: Match.id follows the original
  // backfill's walk order, and ids 1-30 (page 1) hold higher matchIds than
  // ids 31-60 (page 2). So an INCREMENTAL run stops after the first page on
  // which every match already exists: everything older is known too. Walking
  // all ~145 pages every run took ~80 s of back-to-back requests and used up
  // Galaxy's rate limit before detail-ingest began. BACKFILL still walks
  // every page (the way to refresh every match's index fields).
  let matchesFound = 0;
  let page = 1;
  let totalPages = 1;

  do {
    let listResponse;
    try {
      listResponse = await client.listMatches(page);
    } catch (e) {
      if (!(e instanceof GalaxyRateLimitError)) throw e;
      rateLimitNote = `Galaxy rate limit: stopped during the match-list walk at page ${page}; no matches were detail-ingested. Run the sync again later.`;
      console.error(`[sync] ${rateLimitNote}`);
      break;
    }
    totalPages = listResponse.totalPages;

    // Before this page's upserts below, which would make every match on it
    // "known". One query per page.
    let pageFullyKnown = false;
    if (type === "INCREMENTAL" && listResponse.analyses.length > 0) {
      const pageIds = listResponse.analyses.map((m) => String(m.matchId));
      const known = await prisma.match.findMany({
        where: { source: SOURCE, sourceMatchId: { in: pageIds } },
        select: { sourceMatchId: true },
      });
      const knownIds = new Set(known.map((k) => k.sourceMatchId));
      pageFullyKnown = pageIds.every((id) => knownIds.has(id));
    }

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

    if (pageFullyKnown) break;
    page++;
  } while (page <= totalPages);

  // A rate limit during step 1 skips step 2 entirely (nothing selected): the
  // limit is still in force, so every request there would hit it too.
  const listRateLimited = rateLimitNote !== null;
  return detailIngestAndFinish({
    syncRun,
    type,
    token,
    matchesFound,
    errors,
    rateLimitNote,
    maxMatchesToProcess,
    selectMatches: async () =>
      listRateLimited
        ? []
        : prisma.match.findMany({
            where: { ingestStatus: { in: [...NEEDS_INGEST_STATUSES] } },
            orderBy: { id: "desc" },
          }),
  });
}

export class MissingSelfIdentityError extends Error {
  constructor() {
    super(
      'No "you" PlayerIdentity row (source galaxy, isMe) in this DB. It is normally created by the match-list walk of a normal sync; run `npm run sync:incremental` once first. Nothing was fetched.'
    );
    this.name = "MissingSelfIdentityError";
  }
}

export interface DbOnlySyncOptions {
  token: string;
  // Restrict to these sourceMatchIds. Ids not in the DB, or already DONE,
  // are skipped and reported in the result's `skipped`.
  matchIds?: string[];
  maxMatchesToProcess?: number;
  // Sleep between matches (not before the first).
  pauseBetweenMatchesMs?: number;
  // Injectable for tests.
  sleep?: (ms: number) => Promise<void>;
  // One line per match as it completes, plus "waiting Ns..." before each
  // pause. Defaults to console.log.
  log?: (line: string) => void;
}

export interface SkippedMatch {
  sourceMatchId: string;
  reason: "not found" | "already DONE";
}

export interface DbOnlySyncResult extends SyncRunResult {
  // Non-DONE matches selected from the DB before the limit is applied.
  candidates: number;
  skipped: SkippedMatch[];
}

export interface RetryCandidates {
  toIngest: MatchRow[];
  skipped: SkippedMatch[];
}

// The matches a DB-only retry would fetch, in the same order as step 2 of a
// normal sync (id desc). Shared by the real run and the CLI's --dry-run.
export async function selectRetryCandidates(matchIds?: string[]): Promise<RetryCandidates> {
  if (matchIds === undefined) {
    const toIngest = await prisma.match.findMany({
      where: { ingestStatus: { in: [...NEEDS_INGEST_STATUSES] } },
      orderBy: { id: "desc" },
    });
    return { toIngest, skipped: [] };
  }
  const unique = [...new Set(matchIds)];
  const rows = await prisma.match.findMany({
    where: { source: SOURCE, sourceMatchId: { in: unique } },
    orderBy: { id: "desc" },
  });
  const byId = new Map(rows.map((r) => [r.sourceMatchId, r]));
  const skipped: SkippedMatch[] = [];
  for (const id of unique) {
    const row = byId.get(id);
    if (!row) skipped.push({ sourceMatchId: id, reason: "not found" });
    else if (row.ingestStatus === "DONE") skipped.push({ sourceMatchId: id, reason: "already DONE" });
  }
  const needs: readonly string[] = NEEDS_INGEST_STATUSES;
  return { toIngest: rows.filter((r) => needs.includes(r.ingestStatus)), skipped };
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Step 2 only: retries matches taken from our DB, with no analyses/list walk
// (so matchesFound is always 0). Recorded as an INCREMENTAL SyncRun: the
// SyncType enum has no value for a DB-only retry, and adding one would be a
// schema change, so the CLI says so in its output instead.
export async function runDbOnlySync({
  token,
  matchIds,
  maxMatchesToProcess,
  pauseBetweenMatchesMs,
  sleep,
  log = (line) => console.log(line),
}: DbOnlySyncOptions): Promise<DbOnlySyncResult> {
  // ingestMatch's opponent resolution needs the "you" row, which only the
  // list walk creates. It exists after any earlier normal sync; if it
  // doesn't, stop before creating a SyncRun or fetching anything. This is the
  // first DB call here, so it gets the cert check (see firstDbCall).
  const me = await firstDbCall(
    () => prisma.playerIdentity.findFirst({ where: { source: SOURCE, isMe: true } }),
    'looking up the "you" PlayerIdentity'
  );
  if (!me) throw new MissingSelfIdentityError();

  const syncRun = await prisma.syncRun.create({
    data: { type: "INCREMENTAL", startedAt: new Date() },
  });

  let selected: RetryCandidates = { toIngest: [], skipped: [] };
  const result = await detailIngestAndFinish({
    syncRun,
    type: "INCREMENTAL",
    token,
    matchesFound: 0,
    errors: [],
    rateLimitNote: null,
    maxMatchesToProcess,
    pauseBetweenMatchesMs,
    sleep,
    log,
    selectMatches: async () => {
      selected = await selectRetryCandidates(matchIds);
      return selected.toIngest;
    },
  });
  return { ...result, candidates: selected.toIngest.length, skipped: selected.skipped };
}

interface DetailIngestContext {
  syncRun: { id: number; startedAt: Date };
  type: SyncType;
  token: string;
  matchesFound: number;
  errors: SyncRunError[];
  rateLimitNote: string | null;
  maxMatchesToProcess?: number;
  pauseBetweenMatchesMs?: number;
  sleep?: (ms: number) => Promise<void>;
  // Per-match progress lines (DB-only path); unset = none, as runSync has
  // always behaved.
  log?: (line: string) => void;
  // Called after detailAlreadyDone is counted, before any status changes.
  selectMatches: () => Promise<MatchRow[]>;
}

// Step 2 plus the SyncRun bookkeeping and the recomputes, shared by runSync
// and runDbOnlySync.
async function detailIngestAndFinish(ctx: DetailIngestContext): Promise<SyncRunResult> {
  const { syncRun, type, token, matchesFound, errors, maxMatchesToProcess } = ctx;
  let rateLimitNote = ctx.rateLimitNote;
  const pauseMs = ctx.pauseBetweenMatchesMs ?? 0;
  const sleep = ctx.sleep ?? defaultSleep;

  // --- Step 2: detail-ingest. Matches already DONE are never touched here
  // — no Galaxy call is made for them — which is what makes reruns cheap.
  // detailAlreadyDone is captured here, before the loop below can change any
  // status — index-sync above never touches ingestStatus, so this is exactly
  // "how many matches in the index needed no work this run."
  const detailAlreadyDone = await prisma.match.count({ where: { ingestStatus: "DONE" } });
  let rateLimitedMatchId: number | null = null;
  const toIngest = await ctx.selectMatches();

  let matchesProcessed = 0;
  let matchesSynced = 0;
  let matchesFailed = 0;

  const log = ctx.log;
  const total =
    maxMatchesToProcess === undefined ? toIngest.length : Math.min(toIngest.length, maxMatchesToProcess);

  // Strictly sequential: one match at a time (ingestMatch fetches its games
  // one by one and writes them), then the pause, then the next match.
  for (const match of toIngest) {
    if (maxMatchesToProcess !== undefined && matchesProcessed >= maxMatchesToProcess) {
      break;
    }
    if (matchesProcessed > 0 && pauseMs > 0) {
      log?.(`waiting ${pauseMs / 1000}s...`);
      await sleep(pauseMs);
    }

    const externalMatchId = Number(match.sourceMatchId);
    const position = `[${matchesProcessed + 1}/${total}] match ${externalMatchId}`;
    const matchStartedAt = Date.now();
    const elapsed = () => `${((Date.now() - matchStartedAt) / 1000).toFixed(1)}s`;

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
      // all, plus counted decisions the normalized-analysis translator
      // couldn't read (still stored). Unconfirmed analysed_event/event_type
      // cases are logged separately by ingestMatch itself as they're
      // encountered.
      console.log(
        `match ${externalMatchId}: ${summary.gamesIngested} games, ${summary.decisionsIngested} decisions upserted, ${summary.decisionsSkippedNotCounted} not-counted, ${summary.eventsSkippedNoReview} no-review, ${summary.analysisMissing} analysis-missing`
      );

      if (summary.rateLimited) {
        throw new GalaxyRateLimitError(summary.errors.join("; "));
      }
      if (summary.errors.length > 0) {
        throw new Error(summary.errors.join("; "));
      }

      await prisma.match.update({
        where: { id: match.id },
        data: { ingestStatus: "DONE", ingestError: null },
      });
      matchesSynced++;
      log?.(
        `${position}: DONE, ${summary.gamesIngested} games, ${summary.decisionsIngested} decisions, ${elapsed()}`
      );
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
      log?.(`${position}: FAILED (${shortMessage.slice(0, 120)}), ${elapsed()}`);

      matchesFailed++;
      errors.push({ matchId: externalMatchId, error: shortMessage });

      // The one failure that does stop the loop: Galaxy is still rate
      // limiting after the client's retries, so every later match would
      // fail the same way. The remaining ones stay PENDING/FAILED (both
      // retried next run); the note is written once stillPending is known.
      if (e instanceof GalaxyRateLimitError) {
        matchesProcessed++;
        rateLimitedMatchId = externalMatchId;
        break;
      }
      // Otherwise deliberately no rethrow — one match's failure must not
      // stop the loop.
    }

    matchesProcessed++;
  }

  const stillPending = await prisma.match.count({
    where: { ingestStatus: { in: [...NEEDS_INGEST_STATUSES] } },
  });

  if (rateLimitedMatchId !== null) {
    rateLimitNote = `Galaxy rate limit: stopped after match ${rateLimitedMatchId}; ${stillPending} matches left for the next run.`;
    console.error(`[sync] ${rateLimitNote}`);
  }
  if (rateLimitNote !== null) {
    errors.push({ matchId: null, error: rateLimitNote });
  }

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

  // Once, after every match in this run has finished processing — not
  // per-match, not per-decision. Both scripts/backfill.ts and
  // scripts/incremental-sync.ts/api/sync/incremental route through this
  // shared runSync, so hooking in here keeps MistakeStat current after both
  // the full historical backfill and every day-to-day incremental sync,
  // with no separate scheduling needed. Own try/catch, same as the other
  // secondary side-effects in this function (error logging, PlayerIdentity
  // upserts) — a failure recomputing stats shouldn't erase a sync run that
  // otherwise succeeded.
  try {
    await recomputeMistakeStats();
  } catch (e) {
    console.error(
      `Failed to recompute MistakeStat: ${e instanceof Error ? e.message : "unknown error"}`
    );
  }

  // Same reasoning/placement as recomputeMistakeStats above — own try/catch
  // so a failure here can't erase an otherwise-successful sync run.
  try {
    await recomputeRepeatedPositions();
  } catch (e) {
    console.error(
      `Failed to recompute RepeatedPosition: ${e instanceof Error ? e.message : "unknown error"}`
    );
  }

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
    rateLimitNote,
  };
}
