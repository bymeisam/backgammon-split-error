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

### Forum text-only posts and board handoff follow-ups (completed 2026-10-14)
Fixed the single-use board handoff (read once, clear immediately, keep the attachment in component state; Remove does not touch storage), moved the shared forum action and its styles to `app/components/ui/`, restored primary styling in the position builder, restored score/kind captions derived from raw GNU match state with an identifier-safe fallback, removed the orphaned replay comment, and added browser coverage for empty/text-only and handoff/remove behavior plus write-gate propagation on replay, match analysis, `/mistakes`, repeated-position detail and builder (the read-only live Galaxy page stays without the action). Extended the local `bg_test` fixture with a deterministic repeated-position detail. Updated the affected board visual baselines because the new action adds 54px of content height to `/mistakes` boards and the enclosing decision card. No schema, migration, Oracle, or `.env*` changes.

Checks: `npx tsx e2e/seed-test-db.ts` (local `bg_test`: 1 match, 3 games, 11 decisions), `npm test` (816 tests), `npx tsc --noEmit`, `npm run lint`, `NEXT_DIST_DIR=.next-test npm run build`, and `npm run test:visual` (23/23) passed. Captured all four size/theme variants under `design/screenshots/2026-10-14-forum-text-posts/`; the exact files are listed below.

Screenshots:
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-empty--390-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-empty--390-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-empty--1280-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-empty--1280-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-match-board--390-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-match-board--390-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-match-board--1280-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-match-board--1280-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-builder-board--390-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-builder-board--390-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-builder-board--1280-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-builder-board--1280-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-text-only-post--390-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-text-only-post--390-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-text-only-post--1280-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-text-only-post--1280-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-list-with-text-only-post--390-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-list-with-text-only-post--390-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-list-with-text-only-post--1280-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-list-with-text-only-post--1280-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-replay-post-button--390-dark--viewport.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-replay-post-button--390-light--viewport.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-replay-post-button--1280-dark--viewport.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-replay-post-button--1280-light--viewport.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-match-analysis-post-button--390-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-match-analysis-post-button--390-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-match-analysis-post-button--1280-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-match-analysis-post-button--1280-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-mistakes-post-button--390-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-mistakes-post-button--390-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-mistakes-post-button--1280-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-mistakes-post-button--1280-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-repeated-position-post-button--390-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-repeated-position-post-button--390-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-repeated-position-post-button--1280-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-repeated-position-post-button--1280-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-builder-post-button--390-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-builder-post-button--390-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-builder-post-button--1280-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-builder-post-button--1280-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-empty-after-reload--390-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-empty-after-reload--390-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-empty-after-reload--1280-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-empty-after-reload--1280-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-match-board-removed--390-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-match-board-removed--390-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-match-board-removed--1280-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-new-match-board-removed--1280-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-position-builder--390-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-position-builder--390-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-position-builder--1280-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-position-builder--1280-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-list--390-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-list--390-light--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-list--1280-dark--full.png`
- `design/screenshots/2026-10-14-forum-text-posts/forum-write-list--1280-light--full.png`

Implementation commits: `fafd8c4`, `86769f4`.

### Forum text-only posts and board handoff (implemented on `omp/main`, 2026-10-14)
Completed the approved text-only and zero-or-one-board flow. `/forum/new` uses one sessionStorage handoff key, a read-only preview, remove-board fallback, and a usable text-only state when handoff data is absent or invalid. Match/replay, per-match analysis, mistakes, repeated-position detail, and the position builder share the gated `Post to forum` action and navigate only to plain `/forum/new`. The post API permits zero positions; the list omits a zero-board count, and text-only details naturally render no board, analysis, or proposals while retaining ordinary replies and title/body editing. No schema, migration, Oracle, or `.env*` changes.

Checks: `npm run lint`, `npx tsc --noEmit`, `npm test` (**813 tests**), and `npm run build` passed. `npm run test:visual` and authenticated screenshot capture were not run: omp policy blocks Playwright/browser runs unless every `.env*` and shell database URL is confirmed localhost; no such confirmation was provided. No DB/browser checks were run.

Implementation commit: `04389bf`.

### Latest queue polish: hover capture, alignment, separator gap (completed 2026-10-14)
Implemented the final polish on `omp/main`: the review screenshot harness moves the pointer away before capturing the enabled Hard-only “Next card”; interactive proposal chips use `justify-start`; trailing separators have no redundant right margin; the `gradeButton` class indentation is restored. The existing `outline-ink` focus ring remains unchanged because it is visible and consistent.

Checks: `npm test` **792/792**, `npx tsc --noEmit`, `npm run lint`, `NEXT_DIST_DIR=.next-test npm run build`, and `npm run test:visual` (**15/15**) passed. `npx prisma generate` passed after merging master’s single-owner migration. Real local screenshots captured 76 forum and 48 review files under `design/screenshots/2026-10-14-review-refinement-7/`; `/api/review/queue` returned HTTP 200.

Before/after inspection:
- Hard-only state: `-6/review-hard-only-saved--390-dark--viewport.png` had the hover beige fill; `-7/review-hard-only-saved--390-dark--viewport.png` matches the primary “Yes” fill after moving the pointer away.
- Interactive chip: `-6/forum-write-post-5--390-dark--full.png` centered the wrapped move; `-7/forum-write-post-5--390-dark--full.png` is left-aligned.
- Separator gap: the `-7` 1280 tally and checker/cube states show one normal gap before the move/action, without the prior double spacing.

Opened final representatives:
- `design/screenshots/2026-10-14-review-refinement-7/review-hard-only-saved--390-dark--viewport.png`
- `design/screenshots/2026-10-14-review-refinement-7/forum-write-post-5--390-dark--full.png`
- `design/screenshots/2026-10-14-review-refinement-7/forum-write-post-7--390-dark--full.png`
- `design/screenshots/2026-10-14-review-refinement-7/forum-write-post-5-tally-open--1280-light--full.png`

Implementation commit: `4a3c39f`. Merge/generate commit: `ebffba0`. No new schema changes, Oracle writes, or `.env*` changes.

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

- **Review notes at `0c8ed7a` (mouse-away capture, chip alignment, separator gap, indentation)**: `4a3c39f` + master merge `ebffba0` (2026-10-14). Checked: the main session opened the `-7` shots. "Next card" in the Hard-only saved state has the primary fill (same as "Reply"), wrapped interactive chips are left-aligned at 390, and the 1280 tally separator gap is single-width. Code already in master via `86060fb`. omp's docs commit `19ac02b` needs no merge; omp drops its "to check" entries on its next master merge.
- **Review notes at `ebc8857` (focus ring, Hard-only capture, separators)**: `0c8ed7a` (2026-10-14). Checked, and merged into master with `omp/main` at `4a3c39f`, which already includes the start of the `0c8ed7a` polish task (mouse-away, `justify-start`, trailing separator, indentation). Still to come from omp for that task: its "to check" entry and the before/after shots.
- **Review notes at `8f8fd4b` (tally, draft board, chip wrapping, focus, headers)**: `0ab1743` + `ec30993` (2026-10-14). Checked, and `omp/main` at `ebc8857` merged into master (`18789e8`); the follow-ups are in the `ebc8857` task.
- **Review notes at `02831c2` (visual polish, comments, headers)**: `7224f45` (2026-10-14). Checked; the follow-ups are in the `8f8fd4b` task.
- **Review notes at `b657ca6` (screenshots, clean-up, master merge)**: `02831c2` + merge `d6c146e` (2026-10-14). Checked.
- **Phase 4 part 2: proposal APIs and real data**: `322b9a2` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Review: note-aware second try and "Do you know the reason?"**: `2e969ab` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Phase 4 part 1: helpers and UI, no DB**: `421d419` (2026-10-13).
