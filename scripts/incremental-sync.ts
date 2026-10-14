// The day-to-day sync, and the fallback whenever /api/sync/incremental
// reports matches still pending after its capped run. Like
// scripts/backfill.ts it's uncapped (detail-ingests every match not yet
// DONE), but it stops walking Galaxy's match list (newest first) after the
// first page whose matches are all already in the DB, so it only fetches the
// pages with new matches.
//
// Usage: GALAXY_TOKEN=<bearer token> npx tsx scripts/incremental-sync.ts
// (or set GALAXY_TOKEN in .env)
import { runSyncFromCli } from "./runSyncCli";

runSyncFromCli("INCREMENTAL").catch((e) => {
  console.error("FATAL:", e);
  process.exitCode = 1;
});
