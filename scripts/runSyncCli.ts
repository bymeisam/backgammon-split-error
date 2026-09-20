// Shared by scripts/backfill.ts and scripts/incremental-sync.ts — both call
// runSync uncapped (runs to full completion), the only difference between
// them is the `type` tag on the SyncRun row. Progress is logged on a timer
// (not per-match) so runSync's signature stays exactly as specified —
// nothing in lib/sync.ts needs to know a script is watching it.
import "dotenv/config";
import { runSync, type SyncType } from "../lib/sync";
import { prisma } from "../lib/prisma";

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

  const progressInterval = setInterval(() => {
    Promise.all([
      prisma.match.count({ where: { ingestStatus: "DONE" } }),
      prisma.match.count({ where: { ingestStatus: "FAILED" } }),
      prisma.match.count({ where: { ingestStatus: { in: ["PENDING", "INGESTING"] } } }),
    ]).then(([done, failed, remaining]) => {
      console.log(`  ...progress: ${done} done, ${failed} failed, ${remaining} remaining`);
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
