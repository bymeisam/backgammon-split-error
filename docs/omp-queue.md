# omp queue

Hand-offs between Claude Code (on `master`) and omp (on `omp/main` in `../backgammon-omp`). The rules are in AGENTS.md § Two worktrees, one local DB. Newest items at the top of each section. Done happens in two steps. When omp finishes a task, it adds an entry under "Done by omp (to check)" in its own copy on `omp/main`, giving the commit, what changed and which checks ran. That entry is how master knows to review. After the review, only master moves the item to "Checked and done (master)", with the date and commit, and queues any follow-ups as a new task. When omp next merges master, it deletes its "to check" entries for items that master has marked checked. If this file conflicts on a merge, omp keeps master's version and re-adds only its own new "to check" entries.

## Tasks for omp

### Forum: text-only posts, "add a board" buttons, Post to forum everywhere, no IDs (queued 2026-10-14)
**First merge `master`** (at least `8a1049f`): it touches `app/api/forum/posts/route.ts` and `[id]/route.ts` (a `jsonObject()` guard from `lib/forum.ts`). No schema change in this task, so `prisma generate` is all you need.

The problem: the forum list's "New post" (`app/forum/page.tsx:27`) opens `/forum/new` with no prefill, and `NewPostForm.tsx` falls back to raw "GNU Position ID", "GNU Match ID" and "Decision ID" fields. Members can't produce those IDs. The user decided the following (2026-10-14):

1. **Posts may have no board.** `POST /api/forum/posts` accepts 0..`FORUM_LIMITS.positions` attachments (today it's 1..N). A text-only post shows no board or analysis panel, and its replies have no move proposals (the reply composer offers none when the post has no positions). Check the post page, the list and the edit flow with zero positions.
2. **New post form.** `/forum/new` is a plain title and body form. Above it, two buttons: **"Add a board from a match"** (to `/matches`) and **"Add a board from the position builder"** (to `/position-builder`). When a board was handed over (see 4), it shows on top as the read-only preview the `?decision=` path already uses, with a way to remove it. **Remove the "Source" select and every raw ID field** (GNU Position ID, GNU Match ID, Decision ID, Kind) from the UI entirely.
3. **"Post to forum" button** on every board a user can view: the replay (exists, `GameReplay.tsx:210`), the position builder (exists, `PositionBuilder.tsx:371`), plus the match analysis boards, each `/mistakes` row or board, and repeated positions. Same label and component everywhere (a shared one in `app/components/ui/` if there isn't one). Gate it the way the existing buttons are (`isAppWriteEnabled()`). Members must see it (they reach all of those pages, `lib/accessRules.ts`).
4. **No IDs in the URL or on screen.** The button doesn't put decision IDs or GNU IDs in the query string. It writes the attachment (`{ match: { decisionId } }` or `{ manual: { positionId, gnuMatchId, kind } }`, the same shapes the API already takes) to `sessionStorage` under one key, then navigates to plain `/forum/new`. The form reads it (inside try/catch), shows the board and clears it after a successful post. No stored draft means no board, and the two buttons show. The API still validates exactly as now (the decision exists, the IDs are valid), so a tampered draft just gets a 400/404. Drop the old `?decision=` and `?positionId=` query handling, or redirect it to the new flow; nothing outside the app links to it.
5. Keep one board per post from these entry points. "Add another board" can come later; don't build multi-board UI now (the API limit stays).

Not in scope (parked in `docs/future-ideas.md` § Forum): topics or categories, pinning, boards in replies.

Checks: tests for 0-position posts (API and UI), the sessionStorage handoff (present, absent, malformed) and the new button on each page; `npm test`, tsc, lint, build, `npm run test:visual`. Screenshots (`design/screenshots/<YYYY-MM-DD>-<slug>/`) of the new form empty and with a board, a text-only post page, and the button on mistakes, analysis and repeated positions, at 390 and 1280 in light and dark. The new form layout and the button placement are new visible components, so master will bring in the designer and visual reviewer on review.

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

- **Review notes at `0c8ed7a` (mouse-away capture, chip alignment, separator gap, indentation)**: `4a3c39f` + master merge `ebffba0` (2026-10-14). Checked: the main session opened the `-7` shots. "Next card" in the Hard-only saved state has the primary fill (same as "Reply"), wrapped interactive chips are left-aligned at 390, and the 1280 tally separator gap is single-width. Code already in master via `86060fb`. omp's docs commit `19ac02b` needs no merge; omp drops its "to check" entries on its next master merge.
- **Review notes at `ebc8857` (focus ring, Hard-only capture, separators)**: `0c8ed7a` (2026-10-14). Checked, and merged into master with `omp/main` at `4a3c39f`, which already includes the start of the `0c8ed7a` polish task (mouse-away, `justify-start`, trailing separator, indentation). Still to come from omp for that task: its "to check" entry and the before/after shots.
- **Review notes at `8f8fd4b` (tally, draft board, chip wrapping, focus, headers)**: `0ab1743` + `ec30993` (2026-10-14). Checked, and `omp/main` at `ebc8857` merged into master (`18789e8`); the follow-ups are in the `ebc8857` task.
- **Review notes at `02831c2` (visual polish, comments, headers)**: `7224f45` (2026-10-14). Checked; the follow-ups are in the `8f8fd4b` task.
- **Review notes at `b657ca6` (screenshots, clean-up, master merge)**: `02831c2` + merge `d6c146e` (2026-10-14). Checked.
- **Phase 4 part 2: proposal APIs and real data**: `322b9a2` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Review: note-aware second try and "Do you know the reason?"**: `2e969ab` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Phase 4 part 1: helpers and UI, no DB**: `421d419` (2026-10-13).
