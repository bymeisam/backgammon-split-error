# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-15._

## Code

- **Branch:** `master`, clean after this wrap-up commit. **Not pushed:** 13 commits since the user's last push.
- **Checks on master:** tsc and lint clean, vitest 939/939, build clean, visual suite 24/24 with no baseline changes.
- **Scripts:** `scripts/README.md` is the ledger. It lists the remaining tools, the retired one-off backfills (with `git show` restore hashes) and the rule for data fixes: plain SQL goes in a migration, TypeScript fixes are scripts recorded in the ledger. Sync commands: `sync:incremental`, `sync:backfill`, `sync:retry-failed` (the old `npm run backfill` alias is gone).
- **Gate rename:** `isGalaxyEnabled()` is now `isSyncEnabled()` (file `lib/galaxyGate.ts` and the env vars are unchanged).
- **Agents:** every agent role, in Claude Code and omp, runs at medium effort. The Claude Code main session's default effort is medium too (`/effort`).
- **`.env`:** last set by the user with `DATABASE_URL` on local. Never assume where it points, and never change it.

## Snaps (photo → position)

- **`/snap-poc`** is a local-only review tool, kept on purpose. It 404s in production and isn't in the nav.
  - It has the summary table, the photo next to the builder pre-filled from Gemini, a bottom-colour toggle, and Mirror checkers / Mirror numbers / Rotate board.
  - `scripts/snap-poc.ts` (gemini-3.8-flash, free tier, key only in the local `.env`) caches Gemini's answers in `snap-poc/results/`. The user's truths are in `snap-poc/truth/`. Both are gitignored.
- **Result on the user's 10 photos:**
  - 4 boards perfect; 91% of points right on average.
  - Dice 8/10; cube and bar 10/10; no orientation errors.
  - The misses are counts on tall stacks. The weakest were the one real phone photo (20/24) and a sideways shot.
  - Verdict: good enough as "Gemini pre-fills, the user corrects".
- **`Board`** has an optional `homeLeft` mode, off by default. It changes only which number each column shows, so a later app-wide "home on the left" preference would be cheap.
- **Next:** the user takes about 10 real phone photos, and we try one stack-counting prompt change. Then plan **Snaps v1** in the position builder:
  - "From photo": upload or camera, then an API route that calls Gemini;
  - the photo next to the pre-filled board, with the view toggles;
  - no storage;
  - `GEMINI_API_KEY` on Vercel (the user sets it);
  - a "reading…" state and a check on Vercel's function duration;
  - a one-line note that free-tier photos may be used by Google.
  - **Master builds Snaps** (user decided 2026-10-15), including its "From photo" changes to the position builder. **On hold** until the user has new photos.

## Live site (Vercel + Oracle)

- Oracle has 25/25 migrations. **No Oracle steps are prepared or pending.** Galaxy sync is working again; the user ran it against Oracle on 2026-10-15. Whether to also run `sync:backfill -- --dry-run`, to catch matches skipped during the block, isn't settled yet.
- The Clerk dev instance runs on `*.vercel.app`, sign-up is invitation-only (the user confirmed), and Deployment Protection stays on until launch.

## Open threads

- **User:**
  - push;
  - more real Snaps photos;
  - the `/auth/complete` eyebrow, kept for later;
  - inviting members, after presenting the app;
  - git housekeeping (merged branches, `test/pr-review-verification`, one stash), which the user does themselves;
  - optional: the sync backfill dry run.
- **omp:** engine phase 1 is queued in `docs/omp-queue.md`: drive gnubg from Node through Docker, compare with Galaxy on about 200 decisions, and report. No schema, no UI. omp must merge master first.
- **Ideas parked** (`docs/future-ideas.md`, not approved):
  - split the scripts into smaller ones (the user wants to talk this through);
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
