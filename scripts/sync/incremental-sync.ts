// The day-to-day sync, and the fallback whenever /api/sync/incremental
// reports matches still pending after its capped run. It detail-ingests
// every match not yet DONE (unless --limit), but stops walking Galaxy's
// match list (newest first) after the first page whose matches are all
// already in the DB, so it only fetches the pages with new matches.
//
// Paced (scripts/sync/runSyncCli.ts): list pages 1.5 s apart, then one match at a
// time with a 5 s pause between matches, one line per page and per match.
//
// Don't run it while playing on Galaxy, or from another IP/VPN at the same
// time: heavy API use alongside play got the account blocked (2026-10-14).
//
// Usage: npm run sync:incremental -- [--limit N] [--dry-run]
//   --limit N  detail-ingest at most N matches (default: no limit).
//   --dry-run  walks the list (list requests only) and reads the DB; says
//              what's new and what would be ingested; writes nothing.
// Needs GALAXY_TOKEN (in .env or the environment). Prints the target DB's
// host and name first, and warns when it isn't local.
import "dotenv/config";
import { runSyncFromCli } from "./runSyncCli";

runSyncFromCli("INCREMENTAL", process.argv.slice(2)).catch((e) => {
  console.error("FATAL:", e);
  process.exitCode = 1;
});
