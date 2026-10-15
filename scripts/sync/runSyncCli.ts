// Shared by scripts/sync/backfill.ts and scripts/sync/incremental-sync.ts (those files
// are only entry points that load .env, so this one can be imported by tests
// without it). The type is more than a label since 2026-10-14: BACKFILL walks
// every page of Galaxy's match list, INCREMENTAL stops at the first page
// whose matches are all already in the DB (see lib/sync.ts step 1).
//
// Paced like scripts/sync/retry-failed-matches.ts (since 2026-10-14): list pages
// 1.5 s apart, then detail-ingest one match at a time with 5 s between
// matches, one line per page and per match. A Galaxy rate limit that
// outlasts the client's retries stops the run cleanly (lib/sync.ts).
//
// Flags: --limit N (detail-ingest at most N matches; no limit by default)
// and --dry-run (walks the list, list requests only, reads the DB, writes
// nothing and fetches no games). Prints the target DB's host and name first,
// and warns when it isn't local.
//
// Don't run it while playing on Galaxy, or from another IP/VPN at the same
// time: heavy API use alongside play got the account blocked (2026-10-14).
import { runSync, type SyncDryRunResult, type SyncType } from "../../lib/sync";
import { prisma } from "../../lib/prisma";
import { SYNC_ERROR_LOG_RELATIVE_PATH } from "../../lib/errorLog";
import { parseSyncCliArgs, printTarget, type SyncCliArgs } from "./syncCliShared";

const PROGRESS_INTERVAL_MS = 15_000;
export const PAUSE_BETWEEN_MATCHES_MS = 5000;
export const PAUSE_BETWEEN_PAGES_MS = 1500;
const DRY_RUN_LIST_MAX = 20;
const ERROR_PREVIEW_LENGTH = 80;

const NPM_SCRIPT: Record<SyncType, string> = {
  BACKFILL: "sync:backfill",
  INCREMENTAL: "sync:incremental",
};

export function syncUsage(type: SyncType): string {
  return `Usage: npm run ${NPM_SCRIPT[type]} -- [--limit N] [--dry-run]`;
}

// No default limit, and no --match (that's the DB-only retry's).
export function parseSyncArgs(argv: string[]): SyncCliArgs | { error: string } {
  return parseSyncCliArgs(argv, { defaultLimit: undefined, allowMatch: false });
}

export async function runSyncFromCli(
  type: SyncType,
  argv: string[] = [],
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const args = parseSyncArgs(argv);
  if ("error" in args) {
    console.error(args.error);
    console.error(syncUsage(type));
    process.exitCode = 1;
    return;
  }

  const token = env.GALAXY_TOKEN;
  if (!token) {
    console.error(
      "Set GALAXY_TOKEN in your environment (e.g. in .env) before running this script."
    );
    process.exitCode = 1;
    return;
  }

  try {
    if (args.dryRun) {
      await dryRun(type, token, args, env);
    } else {
      await realRun(type, token, args, env);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const limitText = (limit: number | undefined) => (limit === undefined ? "no limit" : `limit ${limit}`);

async function dryRun(type: SyncType, token: string, args: SyncCliArgs, env: NodeJS.ProcessEnv): Promise<void> {
  console.log(
    `Dry run of the ${type.toLowerCase()} sync: walks Galaxy's match list (list requests only, ${PAUSE_BETWEEN_PAGES_MS} ms apart), no game requests, nothing written.`
  );
  printTarget(env);

  const result: SyncDryRunResult = await runSync({
    token,
    type,
    dryRun: true,
    maxMatchesToProcess: args.limit,
    pauseBetweenPagesMs: PAUSE_BETWEEN_PAGES_MS,
    log: (line) => console.log(line),
  });

  console.log(`Pages walked: ${result.pagesWalked} of ${result.totalPages}`);
  console.log(`Matches seen: ${result.matchesSeen}`);
  console.log(`Would be new (not in the DB): ${result.newMatchIds.length}`);
  console.log(`Existing non-DONE matches: ${result.pendingExisting.length}`);
  console.log(
    `Would ingest ${result.wouldIngest.length} of ${result.wouldIngestTotal} (${limitText(args.limit)}, ${PAUSE_BETWEEN_MATCHES_MS} ms pause between matches):`
  );
  const newIds = new Set(result.newMatchIds);
  const pendingById = new Map(result.pendingExisting.map((m) => [m.sourceMatchId, m]));
  for (const id of result.wouldIngest.slice(0, DRY_RUN_LIST_MAX)) {
    const existing = pendingById.get(id);
    if (newIds.has(id) || !existing) {
      console.log(`  ${id}  new`);
    } else {
      const preview = existing.ingestError ? existing.ingestError.slice(0, ERROR_PREVIEW_LENGTH) : "";
      console.log(`  ${id}  ${existing.ingestStatus}${preview ? `  ${preview}` : ""}`);
    }
  }
  if (result.wouldIngest.length > DRY_RUN_LIST_MAX) {
    console.log(`  ... and ${result.wouldIngest.length - DRY_RUN_LIST_MAX} more`);
  }
  if (result.rateLimitNote) {
    console.log(`\n${result.rateLimitNote}`);
  }
}

async function realRun(type: SyncType, token: string, args: SyncCliArgs, env: NodeJS.ProcessEnv): Promise<void> {
  const cap =
    args.limit === undefined
      ? "no cap — runs until every match is DONE or has exhausted retries this run"
      : `up to ${args.limit} matches`;
  console.log(
    `Starting ${type.toLowerCase()} sync (${cap}; list pages ${PAUSE_BETWEEN_PAGES_MS} ms apart, matches one at a time ${PAUSE_BETWEEN_MATCHES_MS} ms apart)...`
  );
  printTarget(env);
  console.log(`Errors will be logged to ${SYNC_ERROR_LOG_RELATIVE_PATH}`);

  // Fixed snapshot, captured once before runSync's own index-sync step —
  // safe to read this early since index-sync only upserts index fields and
  // never touches ingestStatus, so a match DONE now is DONE for the whole
  // run. This is the same "matches present in the index that needed no work
  // this run" figure runSync itself computes as detailAlreadyDone in its
  // returned result. Never changes during the run.
  const alreadyDoneBeforeRun = await prisma.match.count({ where: { ingestStatus: "DONE" } });

  const progressInterval = setInterval(() => {
    Promise.all([
      prisma.match.count({ where: { ingestStatus: "DONE" } }),
      prisma.match.count({ where: { ingestStatus: "FAILED" } }),
      prisma.match.count({ where: { ingestStatus: { in: ["PENDING", "INGESTING"] } } }),
    ]).then(([totalDone, failed, remaining]) => {
      // totalDone is a live count that already includes
      // alreadyDoneBeforeRun — subtract it out so "done" means only what
      // this run itself has completed, starting at 0, not the whole DB's
      // DONE count from the first tick.
      const doneThisRun = totalDone - alreadyDoneBeforeRun;
      console.log(
        `  ...progress: ${doneThisRun} done this run, ${failed} failed, ${remaining} remaining, ${alreadyDoneBeforeRun} already done before this run`
      );
    });
  }, PROGRESS_INTERVAL_MS);

  try {
    const result = await runSync({
      token,
      type,
      maxMatchesToProcess: args.limit,
      pauseBetweenMatchesMs: PAUSE_BETWEEN_MATCHES_MS,
      pauseBetweenPagesMs: PAUSE_BETWEEN_PAGES_MS,
      log: (line) => console.log(line),
    });
    console.log(`${type} sync complete:`, {
      syncRunId: result.syncRunId,
      matchesFound: result.matchesFound,
      matchesProcessed: result.matchesProcessed,
      matchesSynced: result.matchesSynced,
      matchesFailed: result.matchesFailed,
      detailAlreadyDone: result.detailAlreadyDone,
      stillPending: result.stillPending,
    });
    if (result.errors.length > 0) {
      console.log("Errors:");
      for (const e of result.errors) {
        console.log(e.matchId === null ? `  ${e.error}` : `  match ${e.matchId}: ${e.error}`);
      }
    }
    if (result.rateLimitNote) {
      console.log(`\n${result.rateLimitNote}`);
    }
  } finally {
    clearInterval(progressInterval);
  }
}
