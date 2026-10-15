# omp queue

Hand-offs between Claude Code (on `master`) and omp (on `omp/main` in `../backgammon-omp`). The rules are in AGENTS.md § Two worktrees, one local DB. Newest items at the top of each section. Done happens in two steps. When omp finishes a task, it commits the work on `omp/main` (standing approval, see `.omp/RULES.md`) and adds an entry under "Done by omp (to check)" in its own copy on `omp/main`, giving the commit, what changed and which checks ran. That entry is how master knows to review. After the review, only master moves the item to "Checked and done (master)", with the date and commit, and queues any follow-ups as a new task. When omp next merges master, it deletes its "to check" entries for items that master has marked checked. If this file conflicts on a merge, omp keeps master's version and re-adds only its own new "to check" entries.

## Tasks for omp

### Review notes at `834329e` (engine phase 1): 2-ply rerun, merge master, sharper error check (queued 2026-10-15)
**First, merge `master` into `omp/main`**, then run `npx prisma generate` (no schema change). Your branch never merged master for phase 1: your `npm test` ran 874 tests, master has 939. On the merge, **keep master's `docs/current-state.md`** (yours edited a stale 2026-10-14 copy; master rewrites it at wrap-up, don't edit it on `omp/main`), and add your PROGRESS.md entry on top of master's.

The phase 1 work is sound (separate-process GPL boundary, fixture tests, read-only local-only harness, the 21-roll batch, the local-precompute recommendation, the proposal-only results table). What's left is the core question, because the run was at 0-ply.

1. **2-ply works through `hint`.** Master ran your image with `set evaluation chequerplay evaluation plies 2` then `hint` on the opening position with 5-4. It printed `Cubeful 2-ply` for the top 7 candidates and `Cubeful 0-ply` for ranks 8–9: gnubg's move filter keeps only moves within 0.16 of the best for the deeper pass, and the rest stay at 0-ply. So the output is **mixed-depth by design**, and `parseHints` rejects any row whose depth differs from `EVALUATION_PLIES`.
   - Record each candidate's own depth on the `Candidate` (e.g. `plies`).
   - Require only the rank-1 candidate to be at the configured depth; throw only if that one isn't.
   - Set `EVALUATION_PLIES = 2`. Add a fixture with mixed 2-ply/0-ply output and test it. Also check the extra `2-ply cubeful prune [world class]` line under each candidate doesn't confuse the parser.
   - Correct the report's "the CLI only gives 0-ply" section.
2. **Rerun the same 200 decisions at 2-ply** (same seed and sample, so it's directly comparable with the 0-ply numbers; keep both in the report). Local DB, read-only, as before.
3. **Sharper error check.** Drop the fixed 0.08 threshold. `errorSeverity` comes from Galaxy's own label (`mapSeverity` in `lib/ingest.ts`), not app thresholds. So:
   - From the local DB (read-only), get the `rawError` range Galaxy uses for each severity (DOUBTFUL / ERROR / BLUNDER) on CHECKER decisions, and put those cut-offs in the report.
   - Apply the same cut-offs to gnubg's loss on the played move (gnubg best equity − gnubg played equity) and report: for Galaxy's errors and blunders, how many gnubg puts in the same band, a lower band, or none; and for the sample's non-errors, how many gnubg would flag (false alarms).
   - Report the median absolute difference between gnubg's loss and Galaxy's `rawError` on the played move.
4. **Timing.** Split Docker start-up from gnubg's own work: time an empty run (`quit` only) and report it next to the per-position and 21-roll times, at 2-ply. If start-up dominates, say so and note that a long-lived gnubg process would remove it (proposal only, don't build it).
5. **Rename the image** to `bg-gnubg:1.07.001` (constant, Dockerfile build command in the report, `scripts/README.md`).
6. **Report:** update `reports/2026-10-15-gnubg-engine-test.md` in place (or a new dated one that links to it), and revisit the recommendation in the light of the 2-ply numbers. If 2-ply clearly falls short of Galaxy, say what you'd try next (e.g. 3-ply, or `analyse move`), with its timing, but don't build it.

Still **no schema, no UI, no stored results.** Checks: `npm test`, tsc, lint. No screenshots.

## Schema requests (omp → master)

_Use this shape:_
- **Date / task:** …
- **Change:** table or column, type, nullable/default
- **Why:** …
- **Schema rule met:** 1, 2 or 3 (AGENTS.md § Schema rule)

## Done by omp (to check)

- **Engine phase 1: GNU Backgammon local evaluation**: `cb6c6cd` + `834329e` (2026-10-15). Debian Bookworm arm64 Docker image, separate-process Node wrapper with fixture tests, 200-position local read-only comparison and results report. `npm test` 72 files / 874 tests, `npx tsc --noEmit`, and `npm run lint` passed; live `analyze`/all-21-roll smoke passed. Independent read-only rerun reproduced sample and quality metrics (85% best-move agreement; median played-equity difference 0.0035; error catch 8/30); timing varied slightly. No schema/Oracle writes. Review the 0-ply limit and report at `reports/2026-10-15-gnubg-engine-test.md`.

## Checked and done (master)

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
