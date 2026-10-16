// The logic behind scripts/sync/retry-failed-matches.ts (that file is only the
// entry point, so this one can be imported by tests without loading .env).
// Output style follows scripts/sync/runSyncCli.ts: start line, progress timer,
// summary, errors, rateLimitNote.
import { runDbOnlySync, selectRetryCandidates, MissingSelfIdentityError } from "../../lib/sync";
import { prisma } from "../../lib/prisma";
import { SYNC_ERROR_LOG_RELATIVE_PATH } from "../../lib/errorLog";
import { describeDatabaseUrl, parseSyncCliArgs, printTarget } from "./syncCliShared";

const PROGRESS_INTERVAL_MS = 15_000;
export const DEFAULT_LIMIT = 10;
export const DEFAULT_PAUSE_MS = 5000;
const ERROR_PREVIEW_LENGTH = 80;

export const USAGE =
  "Usage: npm run sync:retry-failed -- [--limit N] [--match <sourceMatchId> ...] [--dry-run]";

export interface RetryArgs {
  limit: number;
  matchIds?: string[];
  dryRun: boolean;
}

// See parseSyncCliArgs; the retry has a default limit and takes --match.
export function parseRetryArgs(argv: string[]): RetryArgs | { error: string } {
  const args = parseSyncCliArgs(argv, { defaultLimit: DEFAULT_LIMIT, allowMatch: true });
  if ("error" in args) return args;
  return { limit: args.limit ?? DEFAULT_LIMIT, matchIds: args.matchIds, dryRun: args.dryRun };
}

export { describeDatabaseUrl };

export async function runRetryFailedFromCli(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const args = parseRetryArgs(argv);
  if ("error" in args) {
    console.error(args.error);
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  try {
    if (args.dryRun) {
      await dryRun(args, env);
    } else {
      await realRun(args, env);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Reads the DB only (dbUrl("rw"), the same DB the real run would write), no
// Galaxy call, no write.
async function dryRun(args: RetryArgs, env: NodeJS.ProcessEnv): Promise<void> {
  console.log("Dry run of the DB-only retry: no Galaxy request, nothing written.");
  printTarget(env);

  const me = await prisma.playerIdentity.findFirst({ where: { source: "galaxy", isMe: true } });
  if (!me) console.log(`Warning: a real run would stop here. ${new MissingSelfIdentityError().message}`);

  const { toIngest, skipped } = await selectRetryCandidates(args.matchIds);
  const wouldFetch = toIngest.slice(0, args.limit);
  console.log(
    `Would fetch ${wouldFetch.length} of ${toIngest.length} non-DONE matches (limit ${args.limit}, ${DEFAULT_PAUSE_MS} ms pause between matches):`
  );
  for (const m of wouldFetch) {
    const preview = m.ingestError ? m.ingestError.slice(0, ERROR_PREVIEW_LENGTH) : "";
    console.log(`  ${m.sourceMatchId}  ${m.ingestStatus}${preview ? `  ${preview}` : ""}`);
  }
  printSkipped(skipped);
}

function printSkipped(skipped: { sourceMatchId: string; reason: string }[]): void {
  if (skipped.length === 0) return;
  console.log("Skipped:");
  for (const s of skipped) console.log(`  match ${s.sourceMatchId}: ${s.reason}`);
}

async function realRun(args: RetryArgs, env: NodeJS.ProcessEnv): Promise<void> {
  const token = env.GALAXY_TOKEN;
  if (!token) {
    console.error("Set GALAXY_TOKEN in your environment (e.g. in .env) before running this script.");
    process.exitCode = 1;
    return;
  }

  console.log(
    `Starting DB-only retry (no match-list walk; up to ${args.limit} non-DONE matches from the DB, ${DEFAULT_PAUSE_MS} ms apart). Recorded as an INCREMENTAL SyncRun.`
  );
  printTarget(env);
  console.log(`Errors will be logged to ${SYNC_ERROR_LOG_RELATIVE_PATH}`);

  const alreadyDoneBeforeRun = await prisma.match.count({ where: { ingestStatus: "DONE" } });

  const progressInterval = setInterval(() => {
    Promise.all([
      prisma.match.count({ where: { ingestStatus: "DONE" } }),
      prisma.match.count({ where: { ingestStatus: "FAILED" } }),
      prisma.match.count({ where: { ingestStatus: { in: ["PENDING", "INGESTING"] } } }),
    ]).then(([totalDone, failed, remaining]) => {
      const doneThisRun = totalDone - alreadyDoneBeforeRun;
      console.log(
        `  ...progress: ${doneThisRun} done this run, ${failed} failed, ${remaining} remaining, ${alreadyDoneBeforeRun} already done before this run`
      );
    });
  }, PROGRESS_INTERVAL_MS);

  try {
    let result;
    try {
      result = await runDbOnlySync({
        token,
        matchIds: args.matchIds,
        maxMatchesToProcess: args.limit,
        pauseBetweenMatchesMs: DEFAULT_PAUSE_MS,
      });
    } catch (e) {
      if (!(e instanceof MissingSelfIdentityError)) throw e;
      console.error(e.message);
      process.exitCode = 1;
      return;
    }
    console.log("DB-only retry complete (recorded as an INCREMENTAL SyncRun):", {
      syncRunId: result.syncRunId,
      candidates: result.candidates,
      matchesProcessed: result.matchesProcessed,
      matchesSynced: result.matchesSynced,
      matchesFailed: result.matchesFailed,
      detailAlreadyDone: result.detailAlreadyDone,
      stillPending: result.stillPending,
    });
    printSkipped(result.skipped);
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
