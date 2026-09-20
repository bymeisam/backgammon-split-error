// Same as scripts/backfill.ts (uncapped, runs to completion), intended for
// the smaller, ongoing case — run more frequently, expected to finish
// quickly when there are few pending matches.
//
// Usage: GALAXY_TOKEN=<bearer token> npx tsx scripts/incremental-sync.ts
// (or set GALAXY_TOKEN in .env)
import { runSyncFromCli } from "./runSyncCli";

runSyncFromCli("INCREMENTAL").catch((e) => {
  console.error("FATAL:", e);
  process.exitCode = 1;
});
