# omp queue

Hand-offs between Claude Code (on `master`) and omp (on `omp/main` in `../backgammon-omp`). The rules are in AGENTS.md § Two worktrees, one local DB. Newest items at the top of each section. Done happens in two steps. When omp finishes a task, it adds an entry under "Done by omp (to check)" in its own copy on `omp/main`, giving the commit, what changed and which checks ran. That entry is how master knows to review. After the review, only master moves the item to "Checked and done (master)", with the date and commit, and queues any follow-ups as a new task. When omp next merges master, it deletes its "to check" entries for items that master has marked checked. If this file conflicts on a merge, omp keeps master's version and re-adds only its own new "to check" entries.

## Tasks for omp

### Review notes at `04389bf` (forum text-only posts and board handoff) (queued 2026-10-14)
The code matches the spec. These are the follow-ups, then the screenshots that were skipped.

**Browser runs are cleared:** the user confirmed (2026-10-14) that `.env` and `.env.test` in `../backgammon-omp` point at the local DB only. So run `npm run test:visual` and the screenshot capture this time.

1. **Stale board.** The handoff is cleared only after a successful post. If you press "Post to forum", leave `/forum/new` without posting, then later press "New post" on `/forum`, the old board comes back. Fix it like this: `NewPostForm` reads the handoff once, then clears it straight away, keeping the board only in React state. "Remove board" then needs no storage call, and a reload shows the plain form, which is fine. Update `handoff.test.ts` to match.
2. **Shared component.** Move `PostToForumButton` (and its styles file) from `app/components/match-analysis/` to `app/components/ui/`, as the spec said. Restore the position builder's button to `variant="primary"`, as before (add a `variant` prop if needed). The other pages keep `secondary`.
3. **Match caption.** Match previews now say only "Match position". The old caption came from `forumPositionCaption()` (score and kind, no IDs), so bring it back. `PostToForumButton` can build it when it writes the handoff, the way the builder does. Keep a fallback if decoding fails.
4. **Tests the spec asked for:** the new-post form with no handoff (two buttons, posts `positions: []`), and with a handoff (preview shown, Remove returns to the two buttons). Also test that each page passes `canPostToForum` (replay, match analysis, `/mistakes`, repeated positions, builder) and that it stays false on `/sources/galaxy/matches/[matchId]`. Unit or render tests are fine.
5. **Leftover:** delete the orphaned comment at `GameReplay.tsx:209` ("Links the decision on screen…").
6. **Screenshots** in `design/screenshots/2026-10-14-forum-text-posts/`, at 390 and 1280, light and dark:
   - the new form empty;
   - the new form with a match board;
   - the new form with a builder board;
   - a text-only post page;
   - the forum list with a text-only post;
   - the button on the replay, match analysis, `/mistakes`, a repeated position and the builder.

   List the files in your "to check" entry. Master then brings in the designer and the visual reviewer.

Checks: `npm test`, tsc, lint, build, `npm run test:visual`.

## Schema requests (omp → master)

_Use this shape:_
- **Date / task:** …
- **Change:** table or column, type, nullable/default
- **Why:** …
- **Schema rule met:** 1, 2 or 3 (AGENTS.md § Schema rule)

## Done by omp (to check)


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

- **Forum text-only posts and board handoff**: `04389bf` (2026-10-14). Reviewed; not merged yet. The follow-ups and the skipped screenshots are in the `04389bf` task above.
- **Review notes at `0c8ed7a` (mouse-away capture, chip alignment, separator gap, indentation)**: `4a3c39f` + master merge `ebffba0` (2026-10-14). Checked: the main session opened the `-7` shots. "Next card" in the Hard-only saved state has the primary fill (same as "Reply"), wrapped interactive chips are left-aligned at 390, and the 1280 tally separator gap is single-width. Code already in master via `86060fb`. omp's docs commit `19ac02b` needs no merge; omp drops its "to check" entries on its next master merge.
- **Review notes at `ebc8857` (focus ring, Hard-only capture, separators)**: `0c8ed7a` (2026-10-14). Checked, and merged into master with `omp/main` at `4a3c39f`, which already includes the start of the `0c8ed7a` polish task (mouse-away, `justify-start`, trailing separator, indentation). Still to come from omp for that task: its "to check" entry and the before/after shots.
- **Review notes at `8f8fd4b` (tally, draft board, chip wrapping, focus, headers)**: `0ab1743` + `ec30993` (2026-10-14). Checked, and `omp/main` at `ebc8857` merged into master (`18789e8`); the follow-ups are in the `ebc8857` task.
- **Review notes at `02831c2` (visual polish, comments, headers)**: `7224f45` (2026-10-14). Checked; the follow-ups are in the `8f8fd4b` task.
- **Review notes at `b657ca6` (screenshots, clean-up, master merge)**: `02831c2` + merge `d6c146e` (2026-10-14). Checked.
- **Phase 4 part 2: proposal APIs and real data**: `322b9a2` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Review: note-aware second try and "Do you know the reason?"**: `2e969ab` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Phase 4 part 1: helpers and UI, no DB**: `421d419` (2026-10-13).
