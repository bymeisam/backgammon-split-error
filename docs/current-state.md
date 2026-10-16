# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-16 (screenshot auth-bypass fix, Snaps prompt eval set-up, omp engine review)._

## Code

- **Branch:** `master`, clean after this wrap-up commit. **Not pushed:** 7 commits since the user's last push (`9f9908e` screenshots auth bypass, `ce9461d` Snaps prompt versions + `snaps:score`, `623f069` / `ce83b8a` eval report, `6b9522f` omp queue, `9b440ff` PROGRESS, plus this wrap-up).
- **Checks on master:** tsc and lint clean, vitest 962 (after `ce9461d`), build clean. Visual suite not rerun (no app rendering change).
- **Screenshots:** `npm run build`, then `npm run screenshots [--set=forum|auth|review] [--readonly] [--nav-only]`. Every set but `auth` now signs in through `AUTH_BYPASS` and (outside `--readonly`) gets the local app URL; the spawned server never sees `ORACLE_*`. Latest shots in `design/screenshots/2026-10-16/`.
- **Database URLs:** `DB_TARGET` model (`lib/databaseUrl.ts` is the only reader). `.env` is the user's; never assume or change it.

## Snaps (prompt eval)

- Prompts in `scripts/snaps/prompts.ts` (v1, v2 = v1 + stack counting). Run `npx tsx scripts/snaps/snap-poc.ts --model gemini-3.8-flash --prompt <v>`; answers in `snap-poc/results/<model>/<version>/` (gitignored, cached, re-run to continue). Score with `npm run snaps:score`. Log: `reports/snaps-prompt-eval.md`.
- Photos: set1 = 10 originals, set2 = 19 stream frames from 2026-10-16. Truth entered for 28 (all but `Screenshot 2026-10-16 at 11.41.53 am.png`, which has no v1 answer yet).
- v1: set1 4/10 all points right, 91%; set2 16/18, 99%; dice the main miss on set2 (9/18).
- Free Gemini quota ran out after ~22 calls on 2026-10-16.
- **Waiting on the quota reset (user or a developer run):** v1 on the missing photo, v2 on all 29 (likely two days), `snaps:score`, fill v2 into the log.
- **Then (plan with the user first):** v3 = dice rules + new cube format. User's rule: cube in the middle showing 2+ or on the playing area = offered double (take/pass decision, no owner); on the rail/tray = owned by that side; middle showing 64 = centred. Needs answer-format change, an "offered" toggle on `/snap-poc` (Board can draw an offered cube; builder's `doubleOffered` is always false), truths rechecked (e.g. `11.37.11`). Details in the eval log.

## Open threads

- **User:** push; the `/auth/complete` eyebrow (later); inviting members after presenting the app; git housekeeping.
- **omp:** queue task "Review notes at `3bcd4ed`": test whether the 35/200 0-ply rank-1 rejections are gnubg's move filter leaving a single survivor (0-ply gap above the threshold), confirm by widening the filter, and only then accept them as `single-survivor`. Waiting on the user to start omp. `omp/main` (engine harness, report, `lib/engine/`) is reviewed but not merged; merge after that task unless the user wants it sooner.
- **Ideas parked** (`docs/future-ideas.md`): live on-camera detector, review bundles, progress dashboard, glossary page, app-wide "home on the left".
- **Local test data (local DB only):** forum posts 1–3 and 5–7; proposal replies 8–10; AppUsers 1 (owner), 2 (`local-dev-owner`, NONE), 3 (`local-dev-member`).

## Live site (Vercel + Oracle)

- Oracle has 25/25 migrations. **No Oracle steps prepared or pending.** After pushing, check `/status` on the live site to confirm the Vercel env vars connect.
- Clerk dev instance on `*.vercel.app`, invitation-only sign-up, Deployment Protection on until launch.

## Rules to remember

- Never assume where `.env` points, and never change it. Only the user does that; Oracle runs (`DB_TARGET=oracle`) are the user's alone.
- Every Oracle write needs the user's explicit approval, every time.
- Galaxy sync uses the user's own token only, and never runs while the user is playing.
