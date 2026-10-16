# omp queue

Hand-offs between Claude Code (on `master`) and omp (on `omp/main` in `../backgammon-omp`). The rules are in AGENTS.md § Two worktrees, one local DB. Newest items at the top of each section. Done happens in two steps. When omp finishes a task, it commits the work on `omp/main` (standing approval, see `.omp/RULES.md`) and adds an entry under "Done by omp (to check)" in its own copy on `omp/main`, giving the commit, what changed and which checks ran. That entry is how master knows to review. After the review, only master moves the item to "Checked and done (master)", with the date and commit, and queues any follow-ups as a new task. When omp next merges master, it deletes its "to check" entries for items that master has marked checked. If this file conflicts on a merge, omp keeps master's version and re-adds only its own new "to check" entries.

## Tasks for omp

### Merge master for the `DB_TARGET` database-URL model (queued 2026-10-16)
Master replaced `DATABASE_URL`, `DATABASE_URL_READONLY` and `DATABASE_URL_APP` with a `DB_TARGET` flag (`local` by default) and two URL sets, `LOCAL_DATABASE_URL*` and `ORACLE_DATABASE_URL*`, read only by the new `lib/databaseUrl.ts` (`dbUrl(kind)`, `localDbUrl(kind)`, `isLocalTarget()`). `lib/appDatabaseUrl.ts` is gone (`appDatabaseUrl()` now lives in `lib/databaseUrl.ts`; `lib/prisma.ts` still re-exports it). An ESLint rule and `lib/databaseUrlGuard.test.ts` fail on any other reader. No schema change.

1. **Before merging, the user updates omp's `.env`** (only the user writes it): `DB_TARGET=local` plus `LOCAL_DATABASE_URL`, `LOCAL_DATABASE_URL_READONLY` (and optionally `LOCAL_DATABASE_URL_APP`) with the values its old `DATABASE_URL*` had, and the old names removed. **Local URLs only: never any `ORACLE_*` URL in omp's `.env`.** If omp's `.env.test` exists, it needs the same renames (see `e2e/README.md` § Setup). Don't start the merge until the user says this is done.
2. **Merge `master` into `omp/main`**, then `npx prisma generate`.
3. On `omp/main`, replace any `process.env.DATABASE_URL*` (or `env.DATABASE_URL*`) your branch added with `lib/databaseUrl.ts`'s helpers; `npm run lint` lists them. Never set `DB_TARGET=oracle` or name the `ORACLE_DATABASE_URL*` vars: Oracle runs are the user's.

Checks: `npm test`, tsc, lint.

### Review notes at `1809cce` (engine 2-ply follow-up): explain the 0-ply rejections, sharper loss check, tidy report, scripts move (queued 2026-10-15)
Not merged into master yet. The parser change, 2-ply rerun, Galaxy bands, timing split and rename are good. The open question is the 30/200 positions (and the 21-roll run) rejected because rank 1 came back `Cubeful 0-ply`: until we know why, "2-ply coverage" is unknown.

**First, merge `master` into `omp/main`** (no schema change; `npx prisma generate` anyway). Your last merge (`966f5dc`) was before master's scripts reorganisation (`6964a9c`). On this merge:
- `git mv scripts/gnubg-evaluation.ts scripts/engine/gnubg-evaluation.ts`, fix its relative imports (`../lib/` → `../../lib/`) and any `__dirname` paths.
- `scripts/README.md` will conflict: keep master's version and add your entry as a new `engine/` section with a one-line rule like the others (e.g. "Local only, read-only DB; runs gnubg in Docker").
- Update path mentions in the report. Keep master's `docs/current-state.md`.

1. **Classify the rejections.** Log the 30 rejected positions (decision id, phase, GNU Position ID, Match ID, roll) and the 21-roll position/roll(s) that failed. For each, decide which it is: bear-off database answer (does gnubg's output say so?), only one legal move, only one candidate left after the move filter, or other. Give a table by phase (opening / middle / bear-off) and put 2–3 short raw `hint` excerpts in the report. Note the 21-roll case used sample position 100, a middle-game position, so bear-off alone may not explain it.
2. **Try to get 2-ply where it's meaningful.** On a few rejected positions, try `set evaluation chequerplay evaluation prune off` and/or a wider move filter (`set evaluation movefilter …`), and report whether rank 1 becomes 2-ply and the time cost.
3. **Parser rule from the evidence.** Where 0-ply is exact or harmless (forced move, a single candidate, bear-off database), accept it and mark the analysis (e.g. `exact: true` or keep `plies: 0` with a reason) instead of throwing. Keep throwing for any unexplained 0-ply rank 1. Fixture-test each accepted case. Then rerun the same 200 (same seed) and the 21-roll run, and report the new coverage.
4. **Sharper loss check.** The reported "median absolute difference between GNU loss and Galaxy loss = 0" is over all positions, mostly non-errors where both are 0, so it says nothing. Report it for Galaxy ERROR + BLUNDER decisions only (and separately for DOUBTFUL), plus the mean. Recheck the 13/2/1, 12/1/1 and 7/140 splits after the rerun.
5. **Tidy the report.** `reports/2026-10-15-gnubg-engine-test.md` currently has the old 0-ply table, the 0.08-threshold "also flagged" rows and a stale Verification line (874 tests) above the new section. Rewrite it so it reads as one current result: 2-ply numbers as the main table, the 0-ply numbers kept as a short "earlier 0-ply run" comparison, one Recommendation, one Verification section with the current checks.

Still **no schema, no UI, no stored results.** Local DB read-only only. Checks: `npm test`, tsc, lint. No screenshots.

## Schema requests (omp → master)

_Use this shape:_
- **Date / task:** …
- **Change:** table or column, type, nullable/default
- **Why:** …
- **Schema rule met:** 1, 2 or 3 (AGENTS.md § Schema rule)

## Done by omp (to check)

- **Engine phase 1: GNU Backgammon local evaluation**: `cb6c6cd` + `834329e` (2026-10-15). Debian Bookworm arm64 Docker image, separate-process Node wrapper with fixture tests, 200-position local read-only comparison and results report. `npm test` 72 files / 874 tests, `npx tsc --noEmit`, and `npm run lint` passed; live `analyze`/all-21-roll smoke passed. Independent read-only rerun reproduced sample and quality metrics (85% best-move agreement; median played-equity difference 0.0035; error catch 8/30); timing varied slightly. No schema/Oracle writes. Review the 0-ply limit and report at `reports/2026-10-15-gnubg-engine-test.md`.
- **Engine phase 1 follow-up: 2-ply and local severity comparison**: `1809cce` (2026-10-15). Merged master in `966f5dc`, regenerated Prisma Client, kept master's `docs/current-state.md`, accepted mixed-depth output while requiring rank 1 to be 2-ply, renamed the image to `bg-gnubg:1.07.001`, and reran the deterministic 200-row sample. 170/200 had valid 2-ply rank 1; 30 were rejected as 0-ply. Among supported positions, best-move agreement was 152/170; the 21-roll timing was 642 ms including Docker startup, but its output was rejected on a 0-ply top candidate. Added measured Galaxy severity bands, false-alarm comparison, startup/engine timing, and recommendation to the report. `npm test` 77 files/945 tests, `npx tsc --noEmit`, `npm run lint`, Docker build and live wrapper smoke passed. Read-only local DB only; no schema, Oracle, `.env*`, UI or screenshot changes. Report: `reports/2026-10-15-gnubg-engine-test.md`.
- **Merge master for the `DB_TARGET` database-URL model**: merge `a6ff3f4`, task changes `7d601c5` (2026-10-16). Merged master, regenerated Prisma Client, and changed `scripts/gnubg-evaluation.ts` to read its local read-only URL via `localDbUrl("ro")`; confirmed no direct old `DATABASE_URL*` readers remain in source. `npm test` (79 files / 964 tests), `npx tsc --noEmit`, and `npm run lint` passed. No schema or migration edits, database operations, Oracle access, or screenshots.

## Checked and done (master)

- **Engine phase 1 follow-up: 2-ply and local severity comparison**: `966f5dc` + `1809cce` + `7a1a4ac` (2026-10-15). Reviewed by the main session; not merged into master yet. Mixed-depth parsing, 2-ply rerun, Galaxy severity bands, start-up timing and the image rename are good. 30/200 rejections (0-ply rank 1) are unexplained, the loss-difference median is over mostly non-errors, and the report needs one clean pass. The follow-ups are in the `1809cce` review task above. omp: drop your "to check" entry when you next merge master.
- **Engine phase 1: GNU Backgammon local evaluation**: `cb6c6cd` + `834329e` + `da26d5e` (2026-10-15). Reviewed by the main session; not merged into master yet. The wrapper, tests and harness are sound, but the run was at 0-ply and the branch hadn't merged master. The follow-ups are in the `834329e` review task above. omp: drop your "to check" entry when you next merge master.
- **Review notes at `fafd8c4` + screenshot capture correction (draft kept, post button row, preview spacing, caption test)**: `e90aeca`, `287ff4f`, `3aa5538` (2026-10-14). Checked: code by the main session; 390 shots by the visual reviewer; 1280 shots (`/mistakes`, replay, builder) by the main session. **Merged into master** with `omp/main` at `3aa5538`. Master untracked the force-added `design/screenshots/2026-10-14-forum-post-button/` (the folder is gitignored; don't `git add -f` screenshots). omp: drop your "to check" entries when you next merge master.
- **Review notes at `04389bf` (stale board, shared button, caption, tests, screenshots)**: `fafd8c4` + `86769f4` (2026-10-14). Checked; merged into master with `omp/main` at `3aa5538`.
- **Forum text-only posts and board handoff**: `04389bf` (2026-10-14). Checked; follow-ups were in the `04389bf` task, now done.
- **Review notes at `0c8ed7a` (mouse-away capture, chip alignment, separator gap, indentation)**: `4a3c39f` + master merge `ebffba0` (2026-10-14). Checked: the main session opened the `-7` shots. "Next card" in the Hard-only saved state has the primary fill (same as "Reply"), wrapped interactive chips are left-aligned at 390, and the 1280 tally separator gap is single-width. Code already in master via `86060fb`. omp's docs commit `19ac02b` needs no merge; omp drops its "to check" entries on its next master merge.
- **Review notes at `ebc8857` (focus ring, Hard-only capture, separators)**: `0c8ed7a` (2026-10-14). Checked, and merged into master with `omp/main` at `4a3c39f`, which already includes the start of the `0c8ed7a` polish task (mouse-away, `justify-start`, trailing separator, indentation). Still to come from omp for that task: its "to check" entry and the before/after shots.
- **Review notes at `8f8fd4b` (tally, draft board, chip wrapping, focus, headers)**: `0ab1743` + `ec30993` (2026-10-14). Checked, and `omp/main` at `ebc8857` merged into master (`18789e8`); the follow-ups are in the `ebc8857` task.
- **Review notes at `02831c2` (visual polish, comments, headers)**: `7224f45` (2026-10-14). Checked; the follow-ups are in the `8f8fd4b` task.
- **Review notes at `b657ca6` (screenshots, clean-up, master merge)**: `02831c2` + merge `d6c146e` (2026-10-14). Checked.
- **Phase 4 part 2: proposal APIs and real data**: `322b9a2` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Review: note-aware second try and "Do you know the reason?"**: `2e969ab` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Phase 4 part 1: helpers and UI, no DB**: `421d419` (2026-10-13).
