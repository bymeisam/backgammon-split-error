// The logic behind scripts/retry-failed-matches.ts (that file is only the
// entry point, so this one can be imported by tests without loading .env).
// Output style follows scripts/runSyncCli.ts: start line, progress timer,
// summary, errors, rateLimitNote.
import { runDbOnlySync, selectRetryCandidates, MissingSelfIdentityError } from "../lib/sync";
import { prisma } from "../lib/prisma";
import { SYNC_ERROR_LOG_RELATIVE_PATH } from "../lib/errorLog";

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

// `--match` takes every following argument up to the next flag, and may be
// repeated: `--match 1 2 --match 3` -> ["1", "2", "3"].
export function parseRetryArgs(argv: string[]): RetryArgs | { error: string } {
  let limit = DEFAULT_LIMIT;
  let matchIds: string[] | undefined;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--limit") {
      const value = argv[++i];
      if (value === undefined || !/^\d+$/.test(value) || Number(value) < 1) {
        return { error: `--limit needs a positive whole number, got ${value ?? "nothing"}.` };
      }
      limit = Number(value);
    } else if (arg === "--match") {
      const ids: string[] = [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) ids.push(argv[++i]);
      if (ids.length === 0) return { error: "--match needs at least one sourceMatchId." };
      matchIds = [...(matchIds ?? []), ...ids];
    } else {
      return { error: `Unknown argument: ${arg}` };
    }
  }

  return { limit, matchIds, dryRun };
}

// Host and database name only; never the credentials.
export function describeDatabaseUrl(url: string | undefined): { host: string; database: string; isLocal: boolean } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return {
      host,
      database: parsed.pathname.replace(/^\//, ""),
      isLocal: host === "localhost" || host === "127.0.0.1",
    };
  } catch {
    return null;
  }
}

function printTarget(env: NodeJS.ProcessEnv): void {
  const db = describeDatabaseUrl(env.DATABASE_URL);
  if (!db) {
    console.log("Target DB: DATABASE_URL is not set or not a valid URL.");
    return;
  }
  console.log(`Target DB: host ${db.host}, database ${db.database}`);
  if (!db.isLocal) {
    console.log(`*** This writes to a remote DB (host ${db.host}). ***`);
  }
}

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

// Reads the DB only (DATABASE_URL, the same DB the real run would write), no
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
