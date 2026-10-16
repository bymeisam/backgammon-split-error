# Current state

Start each new session here. `PROGRESS.md` is the history log: grep it only when you need the history behind something. `/wrap-up` rewrites this file at the end of each batch of work. Keep it under about a page: it's a snapshot, not history.

_Last updated: 2026-10-16 (gnubg-in-builder plan, builder ID fixes, pip counts, Snaps two-step orientation card)._

## Code

- **Branch:** `master`, clean after this wrap-up commit. **Not pushed:** ~25 commits since the user's last push (latest `3ecb3a6` numbering from the analysed home, plus this wrap-up).
- **Checks on master:** tsc, lint, vitest 1217, build and the visual suite (24) all pass after `3ecb3a6`.
- **Screenshots:** `npm run build`, then `npm run screenshots [--set=forum|auth|review|snaps] [--readonly] [--nav-only]`. The `snaps` set runs its own `next dev` (`/snap-poc` 404s under `next start`). Latest Snaps shots: `design/screenshots/2026-10-16-snaps-numbering/`.
- **Database URLs:** `DB_TARGET` model (`lib/databaseUrl.ts` is the only reader). `.env` is the user's; never assume or change it.

## gnubg in the position builder

- Plan approved 2026-10-16. Phase A (omp, local): Analyse button in `/position-builder`, input checks, top 4 moves or the cube action, members-only `POST /api/engine/analyze`, nothing stored. Phase B (omp): host gnubg on an Oracle Always Free Arm server; the user approves every Oracle step. Browser/WASM parked (`docs/future-ideas.md`).
- Done on master: `canonicalPositionForForum` flips the position for the top side to move and writes `gameState: 1` (`a4b6795`, checked with gnubg). Pip counts in the builder caption (`0dfd80b`, `lib/pipCount.ts`).
- omp: route + wrapper done (`a6d9fcc`, reviewed, not merged into master). Queue tells it to merge master and finish phase A, plus three review notes (gate the Docker smoke test, pin the cube depth to 2-ply, 400 on malformed IDs).

## Snaps (`/snap-poc` and prompt eval)

- **Orientation card is now two steps** (`9c29356`, `2cf4f31`, `3ecb3a6`; design `reports/2026-10-16-snaps-direction-arrows.md`): step 1 "Make the board match the photo" (Rotate board, Swap colours, Mirror checkers; pips hidden, Save off), step 2 "Make the game right" (Analyzing for Dark/Light, Home board 1–4 with an "H" badge on the board; point 1 in that corner; "← Not like the photo" back link). Old truths load as the same game; new saves add `analyzingFor`/`layoutMirrored`.
- **Waiting on the user:** try the card (Save and arrow keys untested), then re-save the miscorrected truths: `reports/2026-10-16-snaps-truth-orientation-audit.md` lists 10 wrong, 7 probably wrong, 2 unclear. Decide whether the `/snap-poc` caption should name colours ("Dark · Pips … · Light to play") instead of Bottom/Top (proposed, not built). Possible follow-ups: bigger corner badges at 390; whether a back-to-front reading fixed with Mirror checkers should score as wrong.
- **Prompt eval:** prompts in `scripts/snaps/prompts.ts`; run `npx tsx scripts/snaps/snap-poc.ts --model gemini-3.8-flash --prompt <v>`; score `npm run snaps:score`; log `reports/snaps-prompt-eval.md`. Waiting on the Gemini quota: v1 on `11.41.53 am`, v2 on all 29. Then plan v3 with the user (dice rules, cube format: centred / owned / offered).

## Open threads

- **User:** push; try `/snap-poc`; the `/auth/complete` eyebrow (later); inviting members after presenting the app.
- **omp:** phase A of gnubg in the builder (see above); paste "Re-read `git show master:docs/omp-queue.md`" to start it. Then phase B.
- **Ideas parked** (`docs/future-ideas.md`): analyse all 21/36 rolls for a builder position, gnubg in the browser, live on-camera detector, review bundles, progress dashboard, glossary.
- **Local test data (local DB only):** forum posts 1–3 and 5–7 (post 6 has an old top-to-move position, left as is); proposal replies 8–10; AppUsers 1 (owner), 2 (`local-dev-owner`, NONE), 3 (`local-dev-member`).

## Live site (Vercel + Oracle)

- Oracle has 25/25 migrations. **No Oracle steps prepared or pending.** Oracle has no builder-made forum positions, so the encoding fix needs no data correction.
- Clerk dev instance on `*.vercel.app`, invitation-only sign-up, Deployment Protection on until launch.

## Rules to remember

- Never assume where `.env` points, and never change it. Only the user does that; Oracle runs (`DB_TARGET=oracle`) are the user's alone.
- Every Oracle write needs the user's explicit approval, every time.
- Galaxy sync uses the user's own token only, and never runs while the user is playing.
