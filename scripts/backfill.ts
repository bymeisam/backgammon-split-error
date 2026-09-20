// First-run tool: syncs every match, however long that takes. Also the
// fallback whenever /api/sync/incremental reports matches still pending
// after its capped run.
//
// Usage: GALAXY_TOKEN=<bearer token> npx tsx scripts/backfill.ts
// (or set GALAXY_TOKEN in .env)
import { runSyncFromCli } from "./runSyncCli";

runSyncFromCli("BACKFILL").catch((e) => {
  console.error("FATAL:", e);
  process.exitCode = 1;
});
