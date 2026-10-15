# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-15 (omp engine 2-ply follow-up reviewed)._

## Code

- **Branch:** `master`, clean after this wrap-up commit. **Not pushed:** 21 commits since the user's last push (last: this wrap-up, after `2e4e0e5` queue update).
- **Checks on master:** tsc and lint clean, vitest 937/937, guard-hook tests 19/19, build clean. The visual suite wasn't rerun (nothing that renders changed since it was last 24/24).
- **Scripts are in folders by purpose** (`6964a9c`). `scripts/README.md` is the ledger, one section per folder, each opening with its rule:
  - `sync/`: the three sync commands (`sync:incremental`, `sync:backfill`, `sync:retry-failed`) and their shared code;
  - `db/`: `recompute-stats`, `check-oracle-cert`, `sql/`; can write, so never run against Oracle without approval;
  - `readonly/`: `ro-query`, `galaxy-get`, the investigator's tools;
  - `screenshots/index.ts`, `agents/`, `snaps/`.
  - New npm commands: `db:recompute-stats`, `db:check-cert`, `screenshots`. The guard hooks match the new exact paths.
  - `notes-export`/`notes-import` are retired (local is test-only; notes never move local → Oracle). Restore hashes are in the README.
- **Sync flow** (confirmed with the user): step 1 reads Galaxy's match list and adds or updates `Match` rows (incremental stops at the first known page; backfill reads every page). Then `detailIngestAndFinish` (`lib/sync.ts`) imports each unfinished match one at a time (INGESTING → games one by one → DONE or FAILED), rebuilds the stats and records the `SyncRun`. `sync:retry-failed` is that second part on its own.
- **Gate rename:** `isGalaxyEnabled()` is now `isSyncEnabled()` (file `lib/galaxyGate.ts` and the env vars are unchanged).
- **Agents:** every agent role, in Claude Code and omp, runs at medium effort. The main session's default effort is medium too.
- **`.env`:** last set by the user with `DATABASE_URL` on local. Never assume where it points, and never change it.

## Snaps (photo → position)

- **`/snap-poc`** is a local-only review tool, kept on purpose. It 404s in production and isn't in the nav.
  - It has the summary table, the photo next to the builder pre-filled from Gemini, a bottom-colour toggle, and Mirror checkers / Mirror numbers / Rotate board.
  - `scripts/snaps/snap-poc.ts` (gemini-3.8-flash, free tier, key only in the local `.env`) caches Gemini's answers in `snap-poc/results/`. The user's truths are in `snap-poc/truth/`. Both are gitignored.
- **Result on the user's 10 photos:**
  - 4 boards perfect; 91% of points right on average.
  - Dice 8/10; cube and bar 10/10; no orientation errors.
  - The misses are counts on tall stacks. The weakest were the one real phone photo (20/24) and a sideways shot.
  - Verdict: good enough as "Gemini pre-fills, the user corrects".
- **`Board`** has an optional `homeLeft` mode, off by default. It changes only which number each column shows, so a later app-wide "home on the left" preference would be cheap.
- **Owner and status:** master builds Snaps (user decided 2026-10-15), including the "From photo" changes to the position builder. **On hold** until the user has new photos.
- **When the photos come:** try one stack-counting prompt change on old and new photos (Gemini answers are cached), then plan **Snaps v1** for approval: a "From photo" button in the builder (upload or camera), an API route calling Gemini, the photo next to the pre-filled board with the view toggles, no storage, `GEMINI_API_KEY` on Vercel (the user sets it), a "reading…" state, a check on Vercel's function duration, and a one-line note that free-tier photos may be used by Google. Before touching the builder, add a note to omp's queue.

## Live site (Vercel + Oracle)

- Oracle has 25/25 migrations. **No Oracle steps are prepared or pending.** Galaxy sync is working again; the user ran it against Oracle on 2026-10-15. Whether to also run `sync:backfill -- --dry-run`, to catch matches skipped during the block, isn't settled yet.
- The Clerk dev instance runs on `*.vercel.app`, sign-up is invitation-only (the user confirmed), and Deployment Protection stays on until launch.

## Open threads

- **User:**
  - push;
  - new Snaps photos (Snaps is on hold until then);
  - the `/auth/complete` eyebrow, kept for later;
  - inviting members, after presenting the app;
  - git housekeeping (merged branches, `test/pr-review-verification`, one stash), which the user does themselves;
  - optional: the sync backfill dry run.
  - optional: phase 2 of the scripts work, splitting `scripts/screenshots/index.ts` (914 lines) into `helpers.ts`, `nav.ts`, `fixtures.ts`, `shots/{app,forum,auth}.ts`; say go and the master plans it;
  - optional: block `npm run agents:sync` in the investigator guard (it writes files; one-line fix).
- **omp (engine/gnubg), not merged:** phase 1 (`cb6c6cd`, `834329e`, `da26d5e`) and the 2-ply follow-up (`966f5dc`, `1809cce`, `7a1a4ac`) are on `omp/main`. The follow-up is good on mixed-depth parsing, the 2-ply rerun (152/170 best-move agreement), Galaxy severity bands (Galaxy errors 13/2/1 same/lower/none, blunders 12/1/1, 7/140 false alarms), start-up timing (~284 ms Docker) and the `bg-gnubg:1.07.001` rename. Still open, so it's queued again in `docs/omp-queue.md` (`1809cce` review task): 30/200 positions and the 21-roll run were rejected because rank 1 was 0-ply (cause unknown: bear-off DB, forced move, or filter?); the loss-difference median of 0 is over mostly non-errors; the report needs one clean rewrite; and the `scripts/engine/` move (omp merged master before the scripts reorg). **Waiting on omp**; when it reports, review and merge if good. omp's numbers aren't independently verified: the investigator's guard blocks `docker run` and tsx, so verifying needs the user to allow that (user's call, not asked for yet).
- **Ideas parked** (`docs/future-ideas.md`, not approved):
  - a live on-camera detector like GammonSnap (later);
  - review bundles;
  - the progress dashboard;
  - the glossary page;
  - an app-wide "home on the left" setting.
- **Local test data (local DB only):** forum posts 1–3 and 5–7; proposal replies 8–10; AppUsers 1 (owner), 2 (`local-dev-owner`, NONE), 3 (`local-dev-member`).

## Rules to remember

- Never assume where `.env` points, and never change it. Only the user does that. The developer's guard blocks all work while `DATABASE_URL` isn't localhost.
- Every Oracle write needs the user's explicit approval, every time.
- Galaxy sync uses the user's own token only, and never runs while the user is playing.
