// Retries matches that aren't DONE (FAILED, PENDING, or stuck INGESTING),
// taking them from our DB: detail-ingest only, with the same SyncRun
// bookkeeping and MistakeStat/RepeatedPosition recomputes as a normal sync
// (lib/sync.ts runDbOnlySync). Recorded as an INCREMENTAL SyncRun (the
// SyncType enum has no DB-only value; adding one would be a schema change).
//
// How it differs from scripts/incremental-sync.ts: no walk of Galaxy's
// analyses/list pages (up to ~150 requests), so it never discovers new
// matches; it only fetches the matches already in the DB that need it, at
// most --limit of them (default 10), 5 s apart.
//
// Don't run it while playing on Galaxy, or from another IP/VPN at the same
// time: heavy API use alongside play got the account blocked (2026-10-14).
//
// Usage: npm run sync:retry-failed -- [--limit N] [--match <sourceMatchId> ...] [--dry-run]
//   --dry-run  lists what it would fetch; no Galaxy call, no write, no token needed.
// Needs GALAXY_TOKEN (in .env or the environment) for a real run. Prints the
// target DB's host and name first, and warns when it isn't local.
import "dotenv/config";
import { runRetryFailedFromCli } from "./retryFailedCli";

runRetryFailedFromCli(process.argv.slice(2)).catch((e) => {
  console.error("FATAL:", e);
  process.exitCode = 1;
});
