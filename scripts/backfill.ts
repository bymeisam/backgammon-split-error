// First-run tool: walks every page of Galaxy's match list (refreshing every
// match's index fields), then syncs every match not yet DONE, however long
// that takes. Use scripts/incremental-sync.ts for the day-to-day case: it
// stops walking the list at the first page it already knows.
//
// Usage: GALAXY_TOKEN=<bearer token> npx tsx scripts/backfill.ts
// (or set GALAXY_TOKEN in .env)
import { runSyncFromCli } from "./runSyncCli";

runSyncFromCli("BACKFILL").catch((e) => {
  console.error("FATAL:", e);
  process.exitCode = 1;
});
