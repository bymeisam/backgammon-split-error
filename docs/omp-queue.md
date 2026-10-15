# omp queue

Hand-offs between Claude Code (on `master`) and omp (on `omp/main` in `../backgammon-omp`). The rules are in AGENTS.md § Two worktrees, one local DB. Newest items at the top of each section. Done happens in two steps. When omp finishes a task, it commits the work on `omp/main` (standing approval, see `.omp/RULES.md`) and adds an entry under "Done by omp (to check)" in its own copy on `omp/main`, giving the commit, what changed and which checks ran. That entry is how master knows to review. After the review, only master moves the item to "Checked and done (master)", with the date and commit, and queues any follow-ups as a new task. When omp next merges master, it deletes its "to check" entries for items that master has marked checked. If this file conflicts on a merge, omp keeps master's version and re-adds only its own new "to check" entries.

## Tasks for omp

### Engine phase 1: drive GNU Backgammon (gnubg) from Node and test it against Galaxy (queued 2026-10-15)
**First, merge `master` into `omp/main`**, then run `npx prisma generate`. There's no schema change, but master has these changes:
- every agent role is on medium effort (`.omp/config.yml`);
- four one-off backfill scripts are retired, and `scripts/README.md` is the new ledger;
- `isGalaxyEnabled()` is renamed `isSyncEnabled()`;
- AGENTS.md now gives you the analysis engine as a stream.
Master is also building a local-only `/snap-poc` page that adds two optional props to `PositionBuilder` (`initialState`, `extraActions`). If you touch the builder, merge master again first.

Background: `docs/future-ideas.md` § "Our own analysis engine (GNU Backgammon)". Today every analysis comes from Galaxy, only for the position and roll a game produced. This phase only finds out whether gnubg can answer "best move for any position and roll" well and fast enough. **No schema, no UI, no stored results.**

1. **Install gnubg locally.** Find the most reliable way to drive it from Node: command-line mode (`gnubg -t -q`, commands through stdin) or its Python interface. Write the install steps and the chosen approach in the report. gnubg is GPL: run it as a separate process only, and never copy its source into this repo.
2. **Write the wrapper, `lib/engine/gnubg.ts`.**
   - Given a GNU Position ID, a GNU Match ID (or score, match length and cube) and a roll, it returns the ranked candidate moves with equity, and the win/gammon/backgammon chances if available.
   - Also `allRolls(position, match)`, which gives the best move and equity for each of the 21 rolls.
   - Set the evaluation level (e.g. 2-ply) in one place, and record it in each result.
   - Moves in standard notation (higher die first, as the app shows them). Reuse the existing decoders in `lib/gnuPositionId.ts` and `lib/gnuMatchId.ts`.
   - Unit tests for the parsing and the move notation, run against saved gnubg output fixtures, so `npm test` doesn't need gnubg installed.
3. **Compare with Galaxy on real data** (local DB, **read-only**: no writes of any kind). Take a sample of about 200 CHECKER decisions with analysis: a mix of opening, middle game and bear-off, and include the user's errors and blunders. Run gnubg on the same position and roll, and measure:
   - how often gnubg's best move equals Galaxy's best move;
   - the typical equity difference on the played move;
   - how often gnubg also calls the user's error an error;
   - the time per position, and the time for all 21 rolls.
   Galaxy's analysis is read through `getDecisionAnalysis` (`lib/analysis/index.ts`), not straight from `raw`.
4. **Report** in `reports/2026-10-<dd>-gnubg-engine-test.md`. It covers:
   - the install and drive approach;
   - the accuracy and speed numbers, with a few example disagreements;
   - a recommendation: precompute locally vs a small service on the Oracle VM;
   - what a results table would need. Write that last part as a proposal only; any schema goes through "Schema requests".

Checks: `npm test`, tsc, lint. No screenshots (no UI).


## Schema requests (omp → master)

_Use this shape:_
- **Date / task:** …
- **Change:** table or column, type, nullable/default
- **Why:** …
- **Schema rule met:** 1, 2 or 3 (AGENTS.md § Schema rule)

## Done by omp (to check)

## Checked and done (master)

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
