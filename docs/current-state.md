# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-16 (DB_TARGET model, guards, screenshot script split + own server)._

## Code

- **Branch:** `master`, clean after this wrap-up commit. **Not pushed:** 26 commits since the user's last push (today: `8a1f143` DB_TARGET, `8b721bd` guards, `7134549` screenshots split, `f0778e9` screenshots own server, plus this wrap-up). Vercel's env vars are already switched to the new names, so pushing is safe.
- **Checks on master:** tsc and lint clean, vitest 958/958, guard lib tests 27/27, build clean. Visual suite not rerun (no rendering change).
- **Database URLs (`DB_TARGET` model):** `.env` holds `DB_TARGET` (`local` default, or `oracle`) and two URL sets, `LOCAL_DATABASE_URL*` and `ORACLE_DATABASE_URL*` (rw / `_READONLY` / `_APP`). `lib/databaseUrl.ts` is the only reader (`dbUrl`, `localDbUrl`, `isLocalTarget`, `appDatabaseUrl`, `DB_URL_VARS`); ESLint and `lib/databaseUrlGuard.test.ts` enforce it. `prisma7.config.ts` follows the flag. `.env.test` is `DB_TARGET=local` + `LOCAL_*` → `bg_test`. Vercel: `DB_TARGET=oracle` + Oracle read-only and app URLs, no rw URL. omp's `.env` has no `ORACLE_*`.
- **Guards** (`.claude/hooks/`, only the user edits them; auto mode blocks agents): developer DB commands need `DB_TARGET` local everywhere and localhost `LOCAL_*` URLs; any command naming `DB_TARGET=oracle`, an Oracle URL or `--target oracle` is blocked for the developer. Investigator can't run `agents:sync`.
- **Screenshots:** `npm run build`, then `npm run screenshots [--set=forum|auth|review] [--readonly] [--nav-only]`. The script starts its own `next start` with `DB_TARGET=local` (refuses unless the local URLs are localhost) and always stops it. `--base-url` opts out with a warning. Code is split into `scripts/screenshots/{config,helpers,nav,fixtures,server}.ts` and `shots/{app,forum,auth}.ts`.
- **Scripts** are in folders by purpose (`scripts/README.md`). Sync flow and the `isSyncEnabled()` gate are unchanged.
- **`.env`:** set by the user, currently `DB_TARGET=local` (as of the guard check). Never assume or change it.

## Open threads

- **User:**
  - push;
  - **yes/no on the screenshot follow-up:** give the default/review/nav sets `AUTH_BYPASS=true` (since Clerk, 30 of the default run's shots capture the sign-in screen: nav, replay, review, sources, shortcuts) and strip `ORACLE_*` from the spawned server's env. One small developer run;
  - **Snaps questions** (19 new pictures in `snap-poc/`, mostly match-stream frames: clocks, score cards, cube on bar, varied boards, few tall stacks): (1) enter truths for all 19 in `/snap-poc`, or ~8 varied ones? (2) reading the match score from score cards: park or note as a v1 idea? Master's suggested order: run the current prompt on the new set and score it, then try the stack-counting prompt change on both sets, then plan Snaps v1 (see PROGRESS 2026-10-15 for the v1 outline). Phone photos of the user's own board still matter most for real use;
  - the `/auth/complete` eyebrow (later); inviting members after presenting the app; git housekeeping.
- **omp:** queue has (a) the `1809cce` engine review follow-ups (0-ply rank-1 rejections, loss-difference median, report rewrite, `scripts/engine/` move) and (b) the new DB_TARGET task (merge master, `npx prisma generate`, replace any old `DATABASE_URL*` reads). omp's `.env` is ready. Waiting on the user to start omp; when it reports, review and merge if good.
- **Ideas parked** (`docs/future-ideas.md`): live on-camera detector, review bundles, progress dashboard, glossary page, app-wide "home on the left".
- **Local test data (local DB only):** forum posts 1–3 and 5–7; proposal replies 8–10; AppUsers 1 (owner), 2 (`local-dev-owner`, NONE), 3 (`local-dev-member`).

## Live site (Vercel + Oracle)

- Oracle has 25/25 migrations. **No Oracle steps prepared or pending.** The user ran sync against Oracle on 2026-10-16. After pushing, check `/status` on the live site to confirm the new Vercel env vars connect.
- Clerk dev instance on `*.vercel.app`, invitation-only sign-up, Deployment Protection on until launch.

## Rules to remember

- Never assume where `.env` points, and never change it. Only the user does that; Oracle runs (`DB_TARGET=oracle`) are the user's alone.
- Every Oracle write needs the user's explicit approval, every time.
- Galaxy sync uses the user's own token only, and never runs while the user is playing.
