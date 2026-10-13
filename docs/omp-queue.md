# omp queue

Hand-offs between Claude Code (on `master`) and omp (on `omp/main` in `../backgammon-omp`). The rules are in AGENTS.md § Two worktrees, one local DB. Newest items at the top of each section. Done happens in two steps. When omp finishes a task, it adds an entry under "Done by omp (to check)" in its own copy on `omp/main`, giving the commit, what changed and which checks ran. That entry is how master knows to review. After the review, only master moves the item to "Checked and done (master)", with the date and commit, and queues any follow-ups as a new task. When omp next merges master, it deletes its "to check" entries for items that master has marked checked. If this file conflicts on a merge, omp keeps master's version and re-adds only its own new "to check" entries.

## Tasks for omp

### Review notes on `omp/main` at `ebc8857` (queued 2026-10-14)
**Merge master first:** master merged `omp/main` at `ebc8857` (merge `18789e8`). The docs conflicts were resolved on master's side, so take master's `docs/omp-queue.md` and `docs/current-state.md`. In your copy, clear the "to check" entries that master lists under "Checked and done (master)", including the old "Queued review follow-up: keyboard contracts…" entry, which names no commit.

Claude Code reviewed `0ab1743` and `ec30993`. The investigator found no logic defects (vitest 791/791, tsc clean, `prisma/` unchanged). The visual-reviewer opened 12 shots in `design/screenshots/2026-10-14-review-refinement-4/` and `-5/`. Fixed: the tally count beside the chip, the full-width draft board, chips no longer breaking inside a score or move, and the review radii tokens. What's left, all visual:

1. **"Yes" focus ring in dark (second round).** `review-card1-reason-yes-focus--390-dark--viewport.png` still shows a dark slate halo on the near-black page; the light shot shows no clear ring either. `gradeButton` uses `focus-visible:outline-focus outline-offset-2` (`review.styles.ts:108`), so the dark `--focus` token (`app/globals.css` ~173) is too close to `paper`. Make it clearly visible in both themes: either change the token (check every other user of `outline-focus` still looks right) or give `gradeButton` its own ring. The forum chip's ring is a good reference.
2. **Hard-only "Next card" still looks dull (second round)** in `review-hard-only-saved--390-dark` and `--1280-light`. First find out why: it's probably captured while `save.kind === "saving"` (`disabled:opacity-45`, `ReviewSession.tsx:629`) or mid-`transition-colors`. Make the screenshot script wait until the button is enabled, then recapture. Change the style only if the settled button still looks dull. Say which it was.
3. **Chip separators.** The leading space before each "·" is trimmed, because the segments are flex items (`ProposalDisplay.tsx:15-18`, and the cube action at `:32`). Chips read "Position 1· 5-point match· 1–0", and a wrapped line starts with an orphan "·". Render the separator as its own element with horizontal margin, attached to the end of the preceding segment, so lines never start with "·". Same fix for the cube chip.
4. **Could:** `text-left` on the non-interactive `proposalChip` (`forum.styles.ts:61-62`), since wrapped chip text is centred at 390. Also scale the dark "Enter" kbd in `recordedKey` (`review.styles.ts:120`) to the 11px label.

**Visual review:** your delegated visual-reviewer hasn't returned a report in the last three rounds, and items 1 and 2 got past your own check twice. For each item, compare the before and after shots of the same state side by side, and say in the handoff what you saw.

Checks: vitest, tsc, lint, build, `npm run test:visual`. Recapture the changed states, and list them under "Done by omp (to check)". Add a PROGRESS.md entry.

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

- **Review notes at `8f8fd4b` (tally, draft board, chip wrapping, focus, headers)**: `0ab1743` + `ec30993` (2026-10-14). Checked, and `omp/main` at `ebc8857` merged into master (`18789e8`); the follow-ups are in the `ebc8857` task.
- **Review notes at `02831c2` (visual polish, comments, headers)**: `7224f45` (2026-10-14). Checked; the follow-ups are in the `8f8fd4b` task.
- **Review notes at `b657ca6` (screenshots, clean-up, master merge)**: `02831c2` + merge `d6c146e` (2026-10-14). Checked.
- **Phase 4 part 2: proposal APIs and real data**: `322b9a2` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Review: note-aware second try and "Do you know the reason?"**: `2e969ab` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Phase 4 part 1: helpers and UI, no DB**: `421d419` (2026-10-13).
