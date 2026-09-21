// Shared by scripts/backfill.ts and scripts/incremental-sync.ts — both call
// runSync uncapped (runs to full completion), the only difference between
// them is the `type` tag on the SyncRun row. Progress is logged on a timer
// (not per-match) so runSync's signature stays exactly as specified —
// nothing in lib/sync.ts needs to know a script is watching it.
import "dotenv/config";
import { runSync, type SyncType } from "../lib/sync";
import { prisma } from "../lib/prisma";
import { SYNC_ERROR_LOG_RELATIVE_PATH } from "../lib/errorLog";

const PROGRESS_INTERVAL_MS = 15_000;

export async function runSyncFromCli(type: SyncType): Promise<void> {
  const token = process.env.GALAXY_TOKEN;
  if (!token) {
    console.error(
      "Set GALAXY_TOKEN in your environment (e.g. in .env) before running this script."
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Starting ${type.toLowerCase()} sync (no cap — runs until every match is DONE or has exhausted retries this run)...`
  );
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
    const result = await runSync({ token, type });
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
        console.log(`  match ${e.matchId}: ${e.error}`);
      }
    }
  } finally {
    clearInterval(progressInterval);
    await prisma.$disconnect();
  }
}
