# omp queue

Hand-offs between Claude Code (on `master`) and omp (on `omp/main` in `../backgammon-omp`). The rules are in AGENTS.md § Two worktrees, one local DB. Newest items at the top of each section. Done happens in two steps. When omp finishes a task, it adds an entry under "Done by omp (to check)" in its own copy on `omp/main`, giving the commit, what changed and which checks ran. That entry is how master knows to review. After the review, only master moves the item to "Checked and done (master)", with the date and commit, and queues any follow-ups as a new task. When omp next merges master, it deletes its "to check" entries for items that master has marked checked. If this file conflicts on a merge, omp keeps master's version and re-adds only its own new "to check" entries.

## Tasks for omp


## Schema requests (omp → master)

_Use this shape:_
- **Date / task:** …
- **Change:** table or column, type, nullable/default
- **Why:** …
- **Schema rule met:** 1, 2 or 3 (AGENTS.md § Schema rule)

## Done by omp (to check)


### Review notes at `fafd8c4` follow-up (completed 2026-10-14)
Kept `/forum/new` title/body in a dedicated one-use session draft across both Add board routes; successful submit and Cancel clear it. Added draft storage/consume coverage and real `forumPositionCaption` outputs through handoff validation. The board action now sits right-aligned in a gap-separated row with the same bleed inset as the decision row; the builder's primary action remains unchanged. Tightened the preview and Remove board spacing. Updated the affected `/mistakes` visual baselines: the new inset action row adds 12px below the decision chips, so the board and decision-card screenshots gain that vertical spacing.

Checks: `npm test` **868/868**, `npx tsc --noEmit`, `npm run lint`, `NEXT_DIST_DIR=.next-test npm run build`, and `npm run test:visual` (**24/24**) passed. Captured 24 screenshots in `design/screenshots/2026-10-14-forum-post-button/`:
- `mistakes-390-light.png`, `mistakes-390-dark.png`, `mistakes-1280-light.png`, `mistakes-1280-dark.png`
- `match-analysis-390-light.png`, `match-analysis-390-dark.png`, `match-analysis-1280-light.png`, `match-analysis-1280-dark.png`
- `replay-390-light.png`, `replay-390-dark.png`, `replay-1280-light.png`, `replay-1280-dark.png`
- `position-builder-390-light.png`, `position-builder-390-dark.png`, `position-builder-1280-light.png`, `position-builder-1280-dark.png`
- `forum-new-match-board-390-light.png`, `forum-new-match-board-390-dark.png`, `forum-new-match-board-1280-light.png`, `forum-new-match-board-1280-dark.png`
- `forum-new-builder-draft-restored-390-light.png`, `forum-new-builder-draft-restored-390-dark.png`, `forum-new-builder-draft-restored-1280-light.png`, `forum-new-builder-draft-restored-1280-dark.png`

No Prisma, migration, Oracle, or `.env*` changes.
### Second visual refinement: focus, settled rating state, and separators (completed 2026-10-14)
Implemented the remaining visual fixes on `omp/main`: grade-button focus now uses the contrasting `outline-ink` token; the screenshot harness waits for an enabled “Next card” before capturing the Hard-only saved state; checker and cube separators are non-breaking elements attached to the preceding position segment; non-interactive chips are left-aligned. The settled Hard-only button remained correctly primary after the wait, so no fill change was needed. The explicit 11px Enter kbd remains provided by `shared.kbd`.

Checks: `npm test` **792/792**, `npx tsc --noEmit`, `npm run lint`, `NEXT_DIST_DIR=.next-test npm run build`, and `npm run test:visual` (**15/15**) passed. Real local screenshots captured 76 forum and 48 review files under `design/screenshots/2026-10-14-review-refinement-6/`; `/api/review/queue` returned HTTP 200.

Before/after inspection:
- Focus: compared `design/screenshots/2026-10-14-review-refinement-4/review-card1-reason-yes-focus--390-dark--viewport.png` and its `-6` counterpart; the dark ring is now a light, distinct outline. The `-6` light shot also shows a distinct dark outline.
- Hard-only state: compared the `-4` dark and light shots with `-6/review-hard-only-saved--390-dark--viewport.png` and `--1280-light--viewport.png`; the final button is enabled and retains the primary fill, so the dull appearance was disabled capture opacity, not button styling.
- Separators: compared the `-5` checker/cube shots with `-6/forum-write-post-5--390-dark--full.png` and `-6/forum-write-post-7--390-dark--full.png`; separators retain spacing, stay attached to the preceding segment, and no wrapped line starts with `·`.

Opened final representatives:
- `design/screenshots/2026-10-14-review-refinement-6/review-card1-reason-yes-focus--390-dark--viewport.png`
- `design/screenshots/2026-10-14-review-refinement-6/review-card1-reason-yes-focus--390-light--viewport.png`
- `design/screenshots/2026-10-14-review-refinement-6/review-hard-only-saved--390-dark--viewport.png`
- `design/screenshots/2026-10-14-review-refinement-6/review-hard-only-saved--1280-light--viewport.png`
- `design/screenshots/2026-10-14-review-refinement-6/forum-write-post-5--390-dark--full.png`
- `design/screenshots/2026-10-14-review-refinement-6/forum-write-post-7--390-dark--full.png`

Implementation commit: `0c8ed7a`. No Prisma, migration, Oracle, or `.env*` changes.

## Checked and done (master)

- **Review notes at `04389bf` (stale board, shared button, caption, tests, screenshots)**: `fafd8c4` + `86769f4` (2026-10-14). Checked: code read by the main session, screenshots by the visual reviewer and designer. Nothing blocks; follow-ups are in the `fafd8c4` task. Not merged into master yet.
- **Forum text-only posts and board handoff**: `04389bf` (2026-10-14). Checked; follow-ups were in the `04389bf` task, now done.
- **Review notes at `0c8ed7a` (mouse-away capture, chip alignment, separator gap, indentation)**: `4a3c39f` + master merge `ebffba0` (2026-10-14). Checked: the main session opened the `-7` shots. "Next card" in the Hard-only saved state has the primary fill (same as "Reply"), wrapped interactive chips are left-aligned at 390, and the 1280 tally separator gap is single-width. Code already in master via `86060fb`. omp's docs commit `19ac02b` needs no merge; omp drops its "to check" entries on its next master merge.
- **Review notes at `ebc8857` (focus ring, Hard-only capture, separators)**: `0c8ed7a` (2026-10-14). Checked, and merged into master with `omp/main` at `4a3c39f`, which already includes the start of the `0c8ed7a` polish task (mouse-away, `justify-start`, trailing separator, indentation). Still to come from omp for that task: its "to check" entry and the before/after shots.
- **Review notes at `8f8fd4b` (tally, draft board, chip wrapping, focus, headers)**: `0ab1743` + `ec30993` (2026-10-14). Checked, and `omp/main` at `ebc8857` merged into master (`18789e8`); the follow-ups are in the `ebc8857` task.
- **Review notes at `02831c2` (visual polish, comments, headers)**: `7224f45` (2026-10-14). Checked; the follow-ups are in the `8f8fd4b` task.
- **Review notes at `b657ca6` (screenshots, clean-up, master merge)**: `02831c2` + merge `d6c146e` (2026-10-14). Checked.
- **Phase 4 part 2: proposal APIs and real data**: `322b9a2` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Review: note-aware second try and "Do you know the reason?"**: `2e969ab` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Phase 4 part 1: helpers and UI, no DB**: `421d419` (2026-10-13).
