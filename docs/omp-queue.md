# omp queue

Hand-offs between Claude Code (on `master`) and omp (on `omp/main` in `../backgammon-omp`). The rules are in AGENTS.md § Two worktrees, one local DB. Newest items at the top of each section. Mark an item done by moving it to "Done" with the date and commit.

## Tasks for omp

### Review notes on `omp/main` at `b657ca6` (queued 2026-10-13)
Reviewed: Phase 4 part 2 (`322b9a2`) and the review second try (`2e969ab`). The investigator re-ran vitest (759/759), tsc and lint, all clean, and confirmed by reading the code: the proposal transactions, the body-only edit keeping proposals, the duplicate/attachment/kind/legality checks (server-side), the member auth, the tally per position, and the review flow (saves once, Hard after a second try, Again when wrong, whole-card duration, first choice disabled). **No logic defects.** What's left before merge:

**1. Visual coverage (blocker).** None of the screenshots show the new features, so neither has been visually reviewed.
- Forum: the local DB has **0 ForumMoveProposal rows**, so no screenshot shows a chip, a tally or an open draft. Add proposal replies to a test post locally (through the app or the API, as a test AppUser; say which rows you created), then capture: a reply with a checker chip, a reply with a cube chip, a tally with ≥2 rows open, the checker chip's modal, and the reply composer with an open `ProposalDraft` (checker and cube). 390 and 1280, light and dark. The `forum-write-replay-move2` shots don't show the feature, so drop them from this set.
- Review: capture the reason question, the "Not quite" retry front (first choice crossed out), the Hard-only back, and the Hard/Good back. Fix the `/review` capture that timed out on the queue response.
- Then have the visual-reviewer open the new screenshots (not just check that the files exist), and list the files it opened in "Ready for review".

**2. Code clean-up.**
- `app/review/ReviewSession.tsx` and `lib/reviewKeys.ts`: the file-header comments were cut down to a line or two. Restore them, updated for the new flow: the reason step (Y / Enter = yes, N = no), the retry front, and the Hard-only and Hard/Good backs. The repo keeps these headers as the reference for the keys.
- `ReviewSession.tsx` grade buttons: put back `aria-hidden="true"` on the `gradeKey` spans (screen readers now read "⇧H"). Render Good once (`ratingLimit !== "hard"`) and Easy when `ratingLimit === undefined`, instead of two separate Good buttons. Keep the old multi-line JSX formatting.
- Hard-only back: `rate()` saves and advances in one step, so the "Next card / Recorded as Hard" state never appears after a successful save. Either drop that branch or stop advancing on save; pick one and keep the keys in step.
- The reason step shows no key hint. Add one, like the front's hint line ("Y / Enter: yes · N: no").
- `app/forum/[id]/page.tsx` tally: the notation is found by parsing the proposal id out of `first.key.split(":")[1]`. Carry `notation` (and the proposal id) through the tally input instead. `ProposalTallyViewModel.label` is unused, so remove it.
- `ProposalDisplay.tsx`: in `ProposalPreview`, the CUBE case has already returned, so the `proposal.kind === "CHECKER" ? … : …` ternaries below it are dead code. The cube chip (a span) and the checker chip (a button that opens a modal) look the same; give the clickable one an affordance (hover state or an icon).
- `forum.styles.ts`: `proposalDraft` is `flex flex-col`, so "Propose this move" stretches to full width; add `items-start`. Remove `proposalNotice` if it's unused now.
- The comments that got lost or moved: restore the reply POST route's header (what it does, write mode only) and fix the `ReplyComposer` comment "Completed plays remain selected until submitted or explicitly removed." It now sits above the code that clears the drafts after posting.

Checks: vitest, tsc, lint, build. Add a PROGRESS.md entry, then an entry under "Ready for review".

## Schema requests (omp → master)

_Use this shape:_
- **Date / task:** …
- **Change:** table or column, type, nullable/default
- **Why:** …
- **Schema rule met:** 1, 2 or 3 (AGENTS.md § Schema rule)

## Ready for review (omp → master)
### Review: note-aware second try and "Do you know the reason?" (2026-10-13)
Implemented on `omp/main`: note-bearing right answers ask whether the learner knows the reason before revealing the note; wrong non-receiver answers reveal only the note and allow a retry with the first choice disabled. Final outcomes save once, with whole-session duration; second-try right answers save Hard, and wrong outcomes save Again. Added reason/retry keyboard contexts, constrained ratings, and shortcut help.

Verification: targeted `reviewKeys` tests passed (12 tests); Vitest 759/759, TypeScript, lint and production build passed. Updated the screenshot helper for note-aware states. The latest screenshot run wrote 110 files under `design/screenshots/2026-10-13-review-second-try/` but failed its four `/review` shots while waiting for the queue response; the captured review-front image was manually inspected. Visual reviewer was asked to inspect but could not complete the handoff (it reported `notes.txt` missing).
Commit: `2e969ab`.

### Phase 4, part 2: proposal APIs and real data (2026-10-13)
Implemented on `omp/main`; reply routes validate text-or-proposal, attachment ownership and kind, legal checker results, cube actions, and per-reply duplicate positions. Create and replacement edits are transactional; body-only edits preserve existing proposals. Replies display persisted chips and per-position count-sorted tallies. Uses generated `ForumCubeAction`, shared exact labels, non-modal cube chips, decoded-position reuse, client submit validation, and retained checker drafts.

Verification: targeted reply/proposal tests passed; full Vitest **756/756**, `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed. `npm run test:visual` could not run because `.env.test` is absent (left untouched). Forty forum screenshots captured under `design/screenshots/2026-10-13-forum-proposals/`; manually inspected the 390px light post page. The reviewer checked file presence only, not image contents.
Commit: `322b9a2`.

## Done

- **Phase 4 part 2: proposal APIs and real data**: `322b9a2` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Review: note-aware second try and "Do you know the reason?"**: `2e969ab` (2026-10-13). Reviewed; the follow-ups are in the task above.
- **Phase 4 part 1: helpers and UI, no DB**: `421d419` (2026-10-13).
