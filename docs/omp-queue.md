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
### Review: note-aware second try and "Do you know the reason?" (2026-10-13)
Implemented on `omp/main`: note-bearing right answers ask whether the learner knows the reason before revealing the note; wrong non-receiver answers reveal only the note and allow a retry with the first choice disabled. Final outcomes save once, with whole-session duration; second-try right answers save Hard, and wrong outcomes save Again. Added reason/retry keyboard contexts, constrained ratings, and shortcut help.

Verification: targeted `reviewKeys` tests passed (12 tests); Vitest 759/759, TypeScript, lint and production build passed. The screenshot run produced 114 screenshots under `design/screenshots/2026-10-13-review-second-try/`; the review screenshots timed out because the existing screenshot flow waits for the old verdict element when the note-aware reason/retry steps appear. The visual reviewer was asked to inspect the files actually captured.
Commit: `2e969ab`.

### Phase 4, part 2: proposal APIs and real data (2026-10-13)
Implemented on `omp/main`; reply routes validate text-or-proposal, attachment ownership and kind, legal checker results, cube actions, and per-reply duplicate positions. Create and replacement edits are transactional; body-only edits preserve existing proposals. Replies display persisted chips and per-position count-sorted tallies. Uses generated `ForumCubeAction`, shared exact labels, non-modal cube chips, decoded-position reuse, client submit validation, and retained checker drafts.

Verification: targeted reply/proposal tests passed; full Vitest **756/756**, `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed. `npm run test:visual` could not run because `.env.test` is absent (left untouched). Forty forum screenshots captured under `design/screenshots/2026-10-13-forum-proposals/`; manually inspected the 390px light post page. The reviewer checked file presence only, not image contents.
Commit: `322b9a2`.

## Done
### Phase 4, part 1: helpers and UI, no DB (completed 2026-10-13)
Implemented in commit `421d419`; its part 2 persistence and review notes are now integrated above.
