# omp queue

Hand-offs between Claude Code (on `master`) and omp (on `omp/main` in `../backgammon-omp`). The rules are in AGENTS.md § Two worktrees, one local DB. Newest items at the top of each section. Mark an item done by moving it to "Done" with the date and commit.

## Tasks for omp

_No tasks currently._

## Schema requests (omp → master)

_Use this shape:_
- **Date / task:** …
- **Change:** table or column, type, nullable/default
- **Why:** …
- **Schema rule met:** 1, 2 or 3 (AGENTS.md § Schema rule)

## Ready for review (omp → master)

Branch `omp/main` at commit `421d419`; Phase 4 part 1 is ready for review. Added forum proposal drafts, typed proposal chips/tallies, pure validation and tests; no DB/API persistence. Checks: focused proposal tests 7/7, full suite 748/748, `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed. Forum screenshots were not run because the spec does not confirm that all `.env*` database URLs target localhost.

## Done
