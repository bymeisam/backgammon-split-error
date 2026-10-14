# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-14._

## Code

- Branch `master`, clean apart from this wrap-up commit. Pushed through `3711702`; **not pushed: 33 commits with this wrap-up**, including the sync batch, the MEMBER default, and the `omp/main` merge at `3aa5538` (`2782a1b`). On master after the merge: tsc and lint clean, vitest 868/868. Build and visual suite not re-run on master (omp reports both passing on `omp/main`, visual 24/24 against `bg_test`).
- **Forum (from omp):** text-only posts; `/forum/new` is a plain form with "Add a board…" buttons and keeps the typed draft across them; "Post to forum" on replay, match analysis, `/mistakes`, repeated positions (right-aligned under the board) and the builder (full-width primary); boards are handed over via sessionStorage, never IDs.
- **Sync** (`docs/deploy.md` § Syncing stays local): `sync:incremental`, `sync:backfill`, `sync:retry-failed`, all paced, with `--limit` and `--dry-run` (retry also `--match <id>`).
- **`.env`:** last seen with `DATABASE_URL` on a remote DB (probably Oracle) and `DATABASE_URL_READONLY` on local. Never assume and never change it; only the user does.

## Galaxy sync

- The 2026-10-14 "block" was Galaxy's site maintenance, not our sync. The earlier 429s were real, so keep runs paced and never sync while playing.
- **Waiting on the user** to confirm their account works. Then: `npm run sync:incremental -- --dry-run` (check the host it prints), one `sync:retry-failed -- --match <id>`, then paced runs. **Own token only:** another account's token is fine for `sync:retry-failed`, but incremental and backfill would list that account's matches.
- The user ran `sync:retry-failed` with another account's token; which DB, and the counts after, weren't checked. Oracle's sync state is unknown (needs `DATABASE_URL_READONLY` on Oracle to check).

## Live site (Vercel + Oracle)

- Oracle: 25/25 migrations; **no Oracle steps prepared or pending**. Clerk dev instance on `*.vercel.app`; Deployment Protection on until launch (`docs/deploy.md`).

## Open threads

- **User:** push; decide whether to drop the duplicate `npm run backfill`; check `bg_test` is migrated (omp's visual run suggests it is: `migrate status` with the `.env.test` URL); pick the `/auth/complete` eyebrow ("Game Review" recommended, or remove); check Clerk sign-up is invitation-only; "Auth verification" (`docs/deploy.md`) after pushing; invite members.
- **Next batch: Snaps** (`docs/future-ideas.md` § Snaps): Gemini photo → GNU Position ID test script on master. Waiting on the user: `GEMINI_API_KEY` in `.env`, ~10 photos with their true positions.
- **omp:** nothing queued (`docs/omp-queue.md`). `.omp/RULES.md` now says to commit every finished task; `investigator` and `visual_reviewer` run on `gpt-6-luna:medium`. omp's next master merge will delete 24 untracked-on-master screenshots from its worktree (harmless).
- **Ideas saved** (`docs/future-ideas.md`, not approved): our own engine (gnubg) for all-21-rolls and "move one checker"; **review bundles** (related positions reviewed as one card, built positions self-assessed until an engine exists); glossary page.
- **Later, not approved:** rename `isGalaxyEnabled()` → `isSyncEnabled()`; custom-domain move; progress dashboard and `/mistakes` index.
- **Local test data (local DB only):** forum posts 1–3 and 5–7; proposal replies 8–10; AppUsers 1 (owner), 2 (`local-dev-owner`, NONE), 3 (`local-dev-member`).

## Rules to remember

- Never assume where `.env` points, and never change it. Only the user does that.
- Every Oracle write needs the user's explicit approval, every time.
- Galaxy sync with the user's own token only; never while playing.
