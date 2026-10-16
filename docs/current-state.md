# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-17 (phase A review of gnubg in the builder, Snaps v2 partial run, Snaps accuracy-tracking idea)._

## Code

- **Branch:** `master`, clean after this wrap-up commit. **Not pushed:** ~27 commits since the user's last push (latest `8ea1efc` omp queue, plus this wrap-up).
- **Checks on master:** tsc, lint, vitest 1217, build and the visual suite (24) passed at `3ecb3a6`; nothing in app code has changed on master since.
- **Screenshots:** `npm run build`, then `npm run screenshots [--set=forum|auth|review|snaps|builder] [--readonly] [--nav-only]`. The `snaps` set runs its own `next dev`.
- **Database URLs:** `DB_TARGET` model (`lib/databaseUrl.ts` is the only reader). `.env` is the user's; never assume or change it.

## gnubg in the position builder (omp)

- Phase A is built on `omp/main` (`ece315c` + `636be3d`, at `cb21f54`) and reviewed by master: Analyse button, local Docker gnubg (`bg-gnubg:1.07.001`), top 4 moves / cube action, nothing stored. **Not merged into master.**
- **Waiting on omp:** the review-fix task in `docs/omp-queue.md` (cube card hidden for checker decisions, Crawford with an owned cube, forum post drops Crawford, dice show 1–1 when unset, Crawford checkbox and cube action styling, one signed-equity helper, nits), then retake all 16 `builder` shots. Start it with "Re-read `git show master:docs/omp-queue.md`".
- **Then master:** visual-reviewer on all 16 shots (last time only the four 390 ones were checked), then the **user** merges `omp/main`. Phase B (gnubg on Oracle) after that.

## Snaps (`/snap-poc` and prompt eval)

- **Gemini quota:** the free tier is 20 requests a day for `gemini-3.8-flash`, HTTP 503 "high demand" failures count against it, and the window looks rolling (~24 h), not a midnight reset. The v2 run on 2026-10-17 got 6 of 29 (13 × 503, then 429). v1 still lacks `Screenshot 2026-10-16 at 11.41.53 am.png`.
- **Waiting on the user:** free tier (2–3 more days) or billing on the key. Suggested either way: stop `snap-poc.ts` after a few 503s in a row so it doesn't burn the quota. Reruns skip cached answers: `npx tsx scripts/snaps/snap-poc.ts --model gemini-3.8-flash --prompt v2`, then `npm run snaps:score`, log in `reports/snaps-prompt-eval.md`.
- **Then plan v3 with the user:** dice rules, cube format (centred / owned / offered), a `photoIssues` field (cut off, glare, blur). Ideas discussed, not saved yet: on-camera blur/light/tilt checks; warn when Gemini's borne-off tray reading contradicts the checker count (borne-off is derived as 15 minus the board, so a missed checker shows up silently as "off").
- **Still open from before:** user re-saves the miscorrected truths (`reports/2026-10-16-snaps-truth-orientation-audit.md`); caption by colour on `/snap-poc` (proposed, not built).

## Open threads

- **User:** push; Gemini billing decision; try `/snap-poc`; inviting members after presenting the app.
- **Ideas parked** (`docs/future-ideas.md`): Snaps accuracy tracking once live (log each snap, keep photos for offline evals), analyse all 21/36 rolls, gnubg in the browser, live on-camera detector, review bundles, progress dashboard, glossary.
- **Local test data (local DB only):** forum posts 1–3 and 5–7; proposal replies 8–10; AppUsers 1 (owner), 2 (`local-dev-owner`, NONE), 3 (`local-dev-member`).

## Live site (Vercel + Oracle)

- Oracle has 25/25 migrations. **No Oracle steps prepared or pending.**
- Clerk dev instance on `*.vercel.app`, invitation-only sign-up, Deployment Protection on until launch.

## Rules to remember

- Never assume where `.env` points, and never change it. Only the user does that; Oracle runs (`DB_TARGET=oracle`) are the user's alone.
- Every Oracle write needs the user's explicit approval, every time.
- Galaxy sync uses the user's own token only, and never runs while the user is playing.
