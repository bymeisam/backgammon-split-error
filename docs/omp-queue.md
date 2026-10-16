# omp queue

Hand-offs between Claude Code (on `master`) and omp (on `omp/main` in `../backgammon-omp`). The rules are in AGENTS.md § Two worktrees, one local DB. Newest items at the top of each section. Done happens in two steps. When omp finishes a task, it commits the work on `omp/main` (standing approval, see `.omp/RULES.md`) and adds an entry under "Done by omp (to check)" in its own copy on `omp/main`, giving the commit, what changed and which checks ran. That entry is how master knows to review. After the review, only master moves the item to "Checked and done (master)", with the date and commit, and queues any follow-ups as a new task. When omp next merges master, it deletes its "to check" entries for items that master has marked checked. If this file conflicts on a merge, omp keeps master's version and re-adds only its own new "to check" entries.

## Tasks for omp

### Review notes at `3bcd4ed` (engine report): test the move-filter explanation for the 0-ply rank 1 (queued 2026-10-16)
Checked: the merge, `scripts/engine/` move, `localDbUrl("ro")`, the rejection table, the severity-split loss numbers and the one-piece report are good, and fail-closed was the right call without evidence. **Don't merge master first** (nothing new you need).

**Likely cause, to test (not proven).** gnubg's move filter evaluates every move at 0-ply, keeps only those within the threshold of the best (0.16 for the 2-ply filter), and evaluates the survivors deeper. If **only one move survives**, there's nothing left to choose, so gnubg doesn't evaluate it deeper and the whole list stays 0-ply. That's the "single candidate left after the move filter" case from the last task: the hint still *lists* many moves, which is why it looked like ≥2 candidates. Your excerpts fit: 2–2 `bar/23 13/7*` +0.299 vs next +0.096 (gap 0.203); bear-off 1287155 +1.000 vs −1.000; opening 6–1 `13/7 8/7` and 3–1 `8/5 6/5` are clear-cut. `prune off` wouldn't change it (pruning is a different stage), which matches what you saw.

1. **Test it on all 35 + the 2–2 roll:** the 0-ply gap between rank 1 and rank 2. Also, for the 165 accepted positions, the 0-ply gap where you can get it (rank 1's 0-ply equity from a 0-ply `hint` run vs rank 2). The hypothesis holds if every rejection has gap > the filter threshold and (nearly) every accepted one has ≥2 moves within it. Read the threshold from gnubg (`show evaluation` / the movefilter settings in your image), don't assume 0.16. Report a table.
2. **Confirm with gnubg:** on 2–3 rejects, widen the 2-ply move filter so ≥2 moves survive (get the `set evaluation movefilter <ply> <level> <accept> <extra> <threshold>` syntax from `help set evaluation movefilter` inside the image, since last time the command was rejected) and check that rank 1 then comes back 2-ply. Note the time cost.
3. **If it holds, parser rule:** accept a 0-ply rank 1 **only** when every listed candidate is 0-ply and the rank-1 to rank-2 gap is above the configured threshold (or there's a single legal move). Mark it on the `Analysis` (e.g. `depthReason: "single-survivor"`, keep `plies: 0` on candidates). Keep throwing otherwise. Fixture tests for: accepted single-survivor, mixed-depth with 0-ply rank 1 (still throws), gap below threshold (still throws). Rerun the same 200 (same seed) and the 21-roll run, and report coverage and the agreement/loss numbers with and without the single-survivor rows.
4. **If it doesn't hold,** say so with the table and stop there: no parser change.
5. Update the report in place (one current result, as now).

Still no schema, no UI, no stored results. Local DB read-only only. Checks: `npm test`, tsc, lint. No screenshots.

## Schema requests (omp → master)

_Use this shape:_
- **Date / task:** …
- **Change:** table or column, type, nullable/default
- **Why:** …
- **Schema rule met:** 1, 2 or 3 (AGENTS.md § Schema rule)

## Done by omp (to check)

## Checked and done (master)

- **Review notes at `1809cce` (rejections classified, prune test, loss by severity, report rewrite, `scripts/engine/` move)**: `3bcd4ed` + `52edc8c` (2026-10-16). Checked by the main session; not merged into master yet. Good: honest fail-closed result, all 35 rejections logged, severity-split loss (ERROR+BLUNDER median 0.0156), clean report. The 0-ply pattern looks like gnubg's move filter leaving a single survivor; follow-up in the `3bcd4ed` task above. omp: drop your "to check" entries when you next merge master.
- **Merge master for the `DB_TARGET` database-URL model**: `a6ff3f4` + `7d601c5` + `d8c02dc` (2026-10-16). Checked: the merge keeps master's files, `scripts/engine/gnubg-evaluation.ts` reads `localDbUrl("ro")`, and `omp/main` has no `prisma/` changes against master.
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
