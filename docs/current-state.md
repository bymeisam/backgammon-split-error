# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-14._

## Code

- Branch `master`, clean apart from this wrap-up commit. Pushed through `3711702`. **Not pushed (12 with this wrap-up):** `567ebe5` … `c4d9058` (MEMBER default, sign-in, small fixes), `337e72c`, `5cf551a`, `c32a82f` (sync batch), `0740950` (glossary idea), `ebdda76` (omp review notes) and the wrap-ups. vitest 854/854, tsc and lint clean; the build and visual suite were not run this batch (no UI change; `bg_test` still unmigrated).
- **Sync now** (`docs/deploy.md` § Syncing stays local): `npm run sync:incremental`, `sync:backfill` and `sync:retry-failed` (DB-only, takes non-DONE matches from our DB). All are paced: list pages 1.5 s apart (incremental stops at the first fully-known page), one match at a time with 5 s between, a line per match. A 429 is retried (Retry-After or 5/15/45 s), then the run stops cleanly with "N left". All take `--limit` and `--dry-run`; retry also takes `--match <id>`. The `/api/sync/incremental` route is unchanged.
- **Write model and roles:** unchanged (`prismaReadOnly` / `prismaApp` / `prisma`; new `AppUser` rows are `MEMBER`, invite-only sign-up). See `docs/deploy.md`.
- **`.env`:** at the end of this batch `DATABASE_URL` pointed at a remote DB (probably Oracle) and `DATABASE_URL_READONLY` at local. Never assume and never change it; only the user does.

## Galaxy: not blocked after all

- On 2026-10-14 the user's Galaxy account looked blocked everywhere, including play. It turned out to be Galaxy's website being down for maintenance, not something our sync caused. The earlier 429s were real, though, so keep syncing paced and don't sync while playing.
- Next: `npm run sync:incremental -- --dry-run` (check the host it prints), one `npm run sync:retry-failed -- --match <id>`, then paced runs. Use only the user's own token: with another account's token, incremental and backfill would list that account's matches.
- Local DB before the user's retry run: 4,418 DONE, 36 FAILED (all 429), 1 PENDING, 1 INGESTING; the user has since run `sync:retry-failed` (which DB it ran against, and the counts after, weren't checked). Oracle's state is unknown; checking it needs `DATABASE_URL_READONLY` pointed at Oracle. If Oracle never saw those matches, Oracle needs `sync:incremental`, not the retry script.

## Live site (Vercel + Oracle)

- Oracle: 25/25 migrations, no Oracle steps pending. Clerk dev instance on `*.vercel.app`; Deployment Protection on until launch (`docs/deploy.md`).

## Open threads

- **User:**
  - push;
  - decide whether to drop the duplicate `npm run backfill` (same as `sync:backfill`);
  - migrate `bg_test` (`! DATABASE_URL="$(grep '^DATABASE_URL=' .env.test | cut -d= -f2- | tr -d '"')" npx prisma migrate deploy`), then the developer runs `npm run test:visual`;
  - pick the `/auth/complete` eyebrow ("Game Review" recommended, or remove); check Clerk sign-up is invitation-only; run "Auth verification" (`docs/deploy.md`) after pushing; invite members.
- **Next batch: Snaps** (`docs/future-ideas.md` § Snaps). Plan: a script sends ~10 board photos to Gemini (free tier, Flash only; free-tier data may be used by Google), converts the answer to a GNU Position ID and scores it against the true position from `/position-builder`. Waiting on the user: `GEMINI_API_KEY` in `.env` and the photos (+ true positions). The test script can run on master; the builder "From photo" UI is omp's area.
- **omp:** `omp/main` at `3aa5538` merged into master (forum text-only posts, board handoff, "Post to forum" on every board page, draft kept when adding a board). Queue is empty. omp now commits every finished task (`.omp/RULES.md`); its `investigator` and `visual_reviewer` run on `gpt-6-luna:medium`.
- **Idea parked:** glossary page of backgammon terms (`docs/future-ideas.md` § Reference).
- **Later, not approved:** rename `isGalaxyEnabled()` → `isSyncEnabled()`; custom-domain move; progress dashboard and `/mistakes` index (suggested this session).
- **Local test data (local DB only):** forum posts 1–3 and 5–7; proposal replies 8–10; AppUsers 1 (owner), 2 (`local-dev-owner`, NONE), 3 (`local-dev-member`).

## Rules to remember

- Never assume where `.env` points, and never change it. Only the user does that.
- Every Oracle write needs the user's explicit approval, every time.
