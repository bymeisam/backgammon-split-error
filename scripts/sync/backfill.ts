// First-run tool: walks every page of Galaxy's match list (refreshing every
// match's index fields), then syncs every match not yet DONE. Use
// scripts/sync/incremental-sync.ts for the day-to-day case: it stops walking the
// list at the first page it already knows.
//
// Paced (scripts/sync/runSyncCli.ts): list pages 1.5 s apart, then one match at a
// time with a 5 s pause between matches, one line per page and per match.
//
// Don't run it while playing on Galaxy, or from another IP/VPN at the same
// time: heavy API use alongside play got the account blocked (2026-10-14).
//
// Usage: npm run sync:backfill -- [--limit N] [--dry-run]
//   --limit N  detail-ingest at most N matches (default: no limit).
//   --dry-run  walks the list (list requests only) and reads the DB; says
//              what's new and what would be ingested; writes nothing.
// Needs GALAXY_TOKEN (in .env or the environment). Prints the target DB's
// host and name first, and warns when it isn't local.
import "dotenv/config";
import { runSyncFromCli } from "./runSyncCli";

runSyncFromCli("BACKFILL", process.argv.slice(2)).catch((e) => {
  console.error("FATAL:", e);
  process.exitCode = 1;
});
