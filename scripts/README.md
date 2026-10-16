# Scripts

What's in `scripts/`, what has been retired from it, and where future data
fixes go. Each script's header comment has the full details.

Scripts are grouped into one folder per purpose. Each section below opens
with the rule for that folder.

## `sync/`

Talks to Galaxy with the user's token; never while the user is playing.
Writes the sync's results to `DB_TARGET`'s read-write database (`lib/databaseUrl.ts`; see
`docs/deploy.md` § Syncing stays local).

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

## `db/`

Can write to a database. Never run against Oracle without the user's
explicit approval.

- `npm run db:recompute-stats -- [--dry-run]` (`recompute-stats.ts`): rebuilds
  `MistakeStat` and `RepeatedPosition` from the current `Decision` rows. Use it
  after a data fix that changes decisions without a sync.
- `npm run db:check-cert` (`check-oracle-cert.ts`): checks the pinned Oracle CA
  still verifies (also run by `.github/workflows/check-oracle-cert.yml`).
  It writes nothing; it lives here because it is about the database
  connection.
- `sql/app-db-user.sql`: creates the `bg_db_app` write user and its grants on
  Oracle. Run by hand, as the HeatWave admin, only with the owner's approval
  (see its header and `docs/deploy.md`).
- Future TypeScript data fixes go here too (see "Future data fixes" below).

## `readonly/`

Never writes. Safe to run any time. These are the investigator's tools.

- `npx tsx scripts/readonly/ro-query.ts --target local|oracle "SELECT ..."`:
  read-only SQL as `bg_db_ro`.
- `npx tsx scripts/readonly/galaxy-get.ts list <page>` or
  `... game <matchId> <gameIndex>`: read-only Galaxy API fetch. Needs
  `GALAXY_TOKEN`.


## `engine/`

Local only, read-only DB; runs GNU Backgammon in Docker.

- `npx tsx scripts/engine/gnubg-evaluation.ts`: deterministic Galaxy comparison harness.

## `screenshots/`

Dev tooling. Starts its own `next start` against the local DB (it forces
`DB_TARGET=local` and refuses unless the `LOCAL_*` URLs are localhost) and
only talks HTTP to it.

- `npm run screenshots` (`index.ts`): screenshots of the main pages for design
  review. Run `npm run build` first; it never builds. `--set=review|auth|forum`
  and `--nav-only --readonly` set the server's switches themselves;
  `--base-url=<url>` shoots an already-running server instead (unchecked). See
  its header and `docs/design-system.md`. The code is split into `config.ts`
  (flags), `server.ts` (the local server), `helpers.ts`, `nav.ts`,
  `fixtures.ts` and `shots/`.

## `agents/`

Dev tooling. Writes only the generated agent files; no DB, no network.

- `npm run agents:sync` (`sync-agents.ts`): generates `.claude/agents/` and
  `.omp/agents/` from `agents/roles/`, with its test.

## `snaps/`

Proof of concept. No DB; calls Gemini's API.

- `npx tsx scripts/snaps/snap-poc.ts [--force] [--model <id>] [--only <filename>]`:
  Snaps PoC, step 1. Asks Gemini's free tier to read the board in each photo
  in `snap-poc/` (gitignored) and caches the answers in
  `snap-poc/results/<model>/<image>.json`. No DB. Needs `GEMINI_API_KEY`.
  Picks the newest stable Flash model unless `--model` is given, waits 7 s
  between calls and stops on HTTP 429. Layout type and validator are in
  `lib/snapPocLayout.ts`.
  Sideways photos (bar running horizontally): the prompt asks Gemini to
  rotate them 90° first and say which way in `notes`.
- `/snap-poc` (page, not a script): Snaps PoC, step 2. Dev only (404 in
  production, not in the nav). Run `npm run dev`, open `/snap-poc` (add
  `?model=<folder>` to pick a results folder; default is the one with the most
  answers). One photo at a time: the photo on the left, the position builder
  on the right, pre-filled from Gemini's answer. Set "Bottom colour" (light
  or dark), then line the board up with the photo using three independent
  on/off toggles under "Board view", each moving one thing on screen: "Mirror checkers" mirrors the
  checkers left-right and leaves the point numbers where they are (it flips
  which side the bottom player's home board is on); "Mirror numbers" mirrors
  the point numbers (1 bottom-left, Board's `homeLeft`) and changes nothing
  else on the board: triangles, checkers, bar, tray, cube and dice stay
  exactly where they are; "Rotate board" reads the photo turned 180 degrees
  (taken from the other side of the table): the checkers move top<->bottom and
  left<->right, and a cube at the top goes to the bottom, while the numbers,
  triangles, tray and dice stay. Saved truth stays in the photo's own frame
  (the rotation is undone on save), so scoring is unaffected. Any toggle reloads the board from the
  saved truth or Gemini's answer, so unsaved edits are lost: set them first.
  Correct the board, then "Save as correct". That writes
  `snap-poc/truth/<image>.json` (gitignored) and scores Gemini against it in
  the table at the top (points exact, checkers off, bar, tray, dice, cube, and
  the best of the four mirror/flip symmetries). Mapping is in
  `lib/snapPocLayout.ts`, scoring in `lib/snapPocScore.ts`, file access in
  `lib/snapPocFiles.ts`.


## Retired one-offs

These filled values for rows ingested before `lib/ingest.ts` computed them.
Every one has run on both databases, and ingest now computes the value, so
they were deleted on 2026-10-15. To read or rerun one, restore it from git.
They were deleted before `scripts/` was split into folders, so each
`git show` below restores to the old top-level path (`scripts/<name>.ts`);
move a restored fix into `db/` before running it.

| Script | What it did | Local | Oracle | Restore |
|---|---|---|---|---|
| `backfill-source-position-id.ts` | Set `Decision.sourcePositionId` from `raw`'s `review.source_position.formatted_value` | 2026-10-02 | 2026-10-03 (1,236,834 rows) | `git show 66b8b1d:scripts/backfill-source-position-id.ts` |
| `backfill-ply-number.ts` | Set `Decision.plyNumber` (1-4 for a game's first four checker decisions, by `eventId`) | 2026-09-27 | 2026-09-28 (60,612 changed) | `git show 7675b42:scripts/backfill-ply-number.ts` |
| `backfill-played-at.ts` | Recomputed `Match.playedAt` from stored `raw` (the first analysed decision's timestamp) | by 2026-09-28; 2026-10-07 dry run: 0 to change | by 2026-09-28 (0 to change) | `git show 59a3513:scripts/backfill-played-at.ts` |
| `backfill-opponent-identities.ts` | Upserted a `PlayerIdentity` row for every opponent in stored decisions | 2026-09-22 (2,111 created) | Arrived with the 2026-09-23 data dump | `git show 2767b3d:scripts/backfill-opponent-identities.ts` |

Retired tools (deleted 2026-10-15, as part of the folder split, so they
restore to the old top-level path too). Reason for both: local is test-only;
notes never move local → Oracle.

| Script | What it did | Restore |
|---|---|---|
| `notes-export.ts` | Exported every decision note by its natural key to a JSON file, read-only | `git show 6a94c5e:scripts/notes-export.ts` |
| `notes-import.ts` | Imported that file into whichever DB `DATABASE_URL` pointed at (new / newer-wins update / skip). Its `ExportedNote`/`importOutcome` helpers were removed from `lib/decisionNotes.ts` with it | `git show 6a94c5e:scripts/notes-import.ts` (helpers: `git show 6a94c5e:lib/decisionNotes.ts`) |

## Future data fixes

- A fix that's plain SQL goes in a Prisma migration, so `_prisma_migrations`
  records where it ran.
- A fix that needs TypeScript (for example, parsing `raw`) is a script in
  `db/`.
  It has a `--dry-run` mode, makes no live Galaxy calls, and gets a line in
  this file with its local and Oracle run dates.
- Once it has run on both, delete it and move it to "Retired one-offs" with
  its restore command.
