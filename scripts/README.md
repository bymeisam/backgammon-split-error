# Scripts

What's in `scripts/`, what has been retired from it, and where future data
fixes go. Each script's header comment has the full details.

## Tools

Sync (Galaxy to the database; see `docs/deploy.md` § Syncing stays local):
- `npm run sync:backfill -- [--limit N] [--dry-run]` (`backfill.ts`): first-run
  sync. Walks every page of Galaxy's match list, then syncs every match not
  yet DONE.
- `npm run sync:incremental -- [--limit N] [--dry-run]`
  (`incremental-sync.ts`): the day-to-day sync. Stops walking the list at the
  first page it already knows.
- `npm run sync:retry-failed -- [--limit N] [--match <id> ...] [--dry-run]`
  (`retry-failed-matches.ts`): retries matches that aren't DONE, taken from
  our DB, with no list walk.
- `runSyncCli.ts`, `retryFailedCli.ts` and `syncCliShared.ts` are the shared
  CLI logic behind those three, with their tests.

Run directly:
- `npx tsx scripts/recompute-stats.ts [--dry-run]`: rebuilds `MistakeStat`
  and `RepeatedPosition` from the current `Decision` rows. Use it after a data
  fix that changes decisions without a sync.
- `npx tsx scripts/ro-query.ts --target local|oracle "SELECT ..."`:
  read-only SQL as `bg_db_ro`, for the investigator.
- `npx tsx scripts/galaxy-get.ts list <page>` or
  `... game <matchId> <gameIndex>`: read-only Galaxy API fetch, for the
  investigator. Needs `GALAXY_TOKEN`.
- `npx tsx scripts/check-oracle-cert.ts`: checks the pinned Oracle CA still
  verifies (also run by `.github/workflows/check-oracle-cert.yml`).
- `npx tsx scripts/notes-export.ts --out notes-export.json`: exports every
  decision note by its natural key, read-only.
- `npx tsx scripts/notes-import.ts --in notes-export.json [--dry-run]`:
  imports that file into whichever DB `DATABASE_URL` points at.

Dev tooling:
- `npx tsx scripts/design-screenshots.ts`: screenshots of the main pages for
  design review. Needs an app already running on port 3300 against the local
  DB (see its header).
- `npm run agents:sync` (`sync-agents.ts`): generates the agent files from
  `agents/roles/`.

SQL:
- `sql/app-db-user.sql`: creates the `bg_db_app` write user and its grants on
  Oracle. Run by hand, as the HeatWave admin, only with the owner's approval
  (see its header and `docs/deploy.md`).

## Retired one-offs

These filled values for rows ingested before `lib/ingest.ts` computed them.
Every one has run on both databases, and ingest now computes the value, so
they were deleted on 2026-10-15. To read or rerun one, restore it from git.

| Script | What it did | Local | Oracle | Restore |
|---|---|---|---|---|
| `backfill-source-position-id.ts` | Set `Decision.sourcePositionId` from `raw`'s `review.source_position.formatted_value` | 2026-10-02 | 2026-10-03 (1,236,834 rows) | `git show 66b8b1d:scripts/backfill-source-position-id.ts` |
| `backfill-ply-number.ts` | Set `Decision.plyNumber` (1-4 for a game's first four checker decisions, by `eventId`) | 2026-09-27 | 2026-09-28 (60,612 changed) | `git show 7675b42:scripts/backfill-ply-number.ts` |
| `backfill-played-at.ts` | Recomputed `Match.playedAt` from stored `raw` (the first analysed decision's timestamp) | by 2026-09-28; 2026-10-07 dry run: 0 to change | by 2026-09-28 (0 to change) | `git show 59a3513:scripts/backfill-played-at.ts` |
| `backfill-opponent-identities.ts` | Upserted a `PlayerIdentity` row for every opponent in stored decisions | 2026-09-22 (2,111 created) | Arrived with the 2026-09-23 data dump | `git show 2767b3d:scripts/backfill-opponent-identities.ts` |

## Future data fixes

- A fix that's plain SQL goes in a Prisma migration, so `_prisma_migrations`
  records where it ran.
- A fix that needs TypeScript (for example, parsing `raw`) is a script here.
  It has a `--dry-run` mode, makes no live Galaxy calls, and gets a line in
  this file with its local and Oracle run dates.
- Once it has run on both, delete it and move it to "Retired one-offs" with
  its restore command.
