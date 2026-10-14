# omp queue

Hand-offs between Claude Code (on `master`) and omp (on `omp/main` in `../backgammon-omp`). The rules are in AGENTS.md § Two worktrees, one local DB. Newest items at the top of each section. Done happens in two steps. When omp finishes a task, it adds an entry under "Done by omp (to check)" in its own copy on `omp/main`, giving the commit, what changed and which checks ran. That entry is how master knows to review. After the review, only master moves the item to "Checked and done (master)", with the date and commit, and queues any follow-ups as a new task. When omp next merges master, it deletes its "to check" entries for items that master has marked checked. If this file conflicts on a merge, omp keeps master's version and re-adds only its own new "to check" entries.

## Tasks for omp

- **2026-10-14, master added migration `20261014100000_app_user_single_owner`** (additive: generated `AppUser.ownerSlot` plus a unique index, at most one OWNER row; already applied to the shared local `app_dev`). Merge master and run `npx prisma generate` before your next app run. The local `AUTH_BYPASS` owner row (`local-dev-owner`) is now stored as `NONE`; the bypass still acts as owner in memory.

### Review notes on `omp/main` at `0c8ed7a` (queued 2026-10-14)
Merge master first (it has the single-owner migration above; run `npx prisma generate` after).

Claude Code reviewed `0c8ed7a`: the code is fine, and the visual-reviewer plus the main session opened the `-6` shots. Fixed: separators spaced and attached, no line starting with "·", the cube chip left-aligned, no tally regressions. The "Yes" focus ring is now visible (a subtle grey outline in dark). The main session looked at `review-hard-only-saved--390-dark`: "Next card" is light beige, not disabled-grey. It's almost certainly the **hover** colour (`hover:bg-primary/86`), because the script clicks "Hard" and "Next card" renders under the still-hovering mouse. Small polish left:

1. **Screenshot script:** after clicking "Hard" (and before any capture where a button appears under the cursor), move the mouse away, e.g. `page.mouse.move(0, 0)`, then settle. Recapture the Hard-only saved state and confirm "Next card" has the same fill as "Yes".
2. **Interactive chip alignment:** the clickable move chips still centre their wrapped text ("6/4 4/3 ↗" sits mid-chip at 390). `Button`'s base centres the content, so add `justify-start` to `proposalInteractiveChip` (`forum.styles.ts:62`).
3. **Trailing separator gap:** at 1280, "…2-1 to play ·" followed by the move leaves a double-width gap (`appendSeparator` plus `proposalSeparator: "mx-1"`, `ProposalDisplay.tsx:18`, `forum.styles.ts:65`). Tighten the trailing separator's right margin, or let the move's own gap do the spacing.
4. **Formatting:** the `gradeButton` class string in `review.styles.ts:108` lost its indentation. Restore it.
5. **Optional:** make the "Yes"/grade-button focus ring a little stronger (e.g. `outline-[3px]`), if it stays consistent with other focus rings.

Checks: vitest, tsc, lint, build, `npm run test:visual`. Before/after shots for items 1–3, listed under "Done by omp (to check)". Add a PROGRESS.md entry.

## Schema requests (omp → master)

_Use this shape:_
- **Date / task:** …
- **Change:** table or column, type, nullable/default
- **Why:** …
- **Schema rule met:** 1, 2 or 3 (AGENTS.md § Schema rule)

## Done by omp (to check)

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

- **Review notes at `ebc8857` (focus ring, Hard-only capture, separators)**: `0c8ed7a` (2026-10-14). Checked; the small polish left is in the `0c8ed7a` task. Not yet merged into master.
- **Review notes at `8f8fd4b` (tally, draft board, chip wrapping, focus, headers)**: `0ab1743` + `ec30993` (2026-10-14). Checked, and `omp/main` at `ebc8857` merged into master (`18789e8`); the follow-ups are in the `ebc8857` task.
- **Review notes at `02831c2` (visual polish, comments, headers)**: `7224f45` (2026-10-14). Checked; the follow-ups are in the `8f8fd4b` task.
- **Review notes at `b657ca6` (screenshots, clean-up, master merge)**: `02831c2` + merge `d6c146e` (2026-10-14). Checked.
- **Phase 4 part 2: proposal APIs and real data**: `322b9a2` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Review: note-aware second try and "Do you know the reason?"**: `2e969ab` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Phase 4 part 1: helpers and UI, no DB**: `421d419` (2026-10-13).
