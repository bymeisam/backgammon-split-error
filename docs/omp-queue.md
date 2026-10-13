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

**3. Merge master (app-wide write switch, `5ba0fa4` + `4c0045b`).** Every in-app write now has one client and one switch: `prismaApp` (`lib/prisma.ts`, `DATABASE_URL_APP`, falls back to `DATABASE_URL` outside production) and `isAppWriteEnabled()` (`lib/appWriteGate.ts`). They replace `prisma` and `isGalaxyEnabled()` on every forum write, every notes/tags/review write and their UI flags. `prismaAuth` and `DATABASE_URL_AUTH` are gone (AppUser provisioning uses `prismaApp`). `isGalaxyEnabled()` is now for Galaxy and sync only. `/api/review`, `/api/tags` and `/api/decisions/` are no longer in `proxy.ts`'s Galaxy list. Merging master will conflict in `app/api/forum/posts/[id]/replies/route.ts` and `app/api/forum/replies/[id]/route.ts`, and probably in `app/review/page.tsx`. Resolve by keeping your hunks, with the gate as `isAppWriteEnabled()` and every write (including `tx.forumMoveProposal`) on `prismaApp`. Any other write or write-UI flag on `omp/main` (forum or review) should use the same pair. Mock `prismaApp` and `@/lib/appWriteGate` in route tests (see `app/api/forum/posts/hideAnalysis.test.ts` on master). No schema change.

Checks: vitest, tsc, lint, build. Add a PROGRESS.md entry, then an entry under "Ready for review".

## Schema requests (omp → master)

_Use this shape:_
- **Date / task:** …
- **Change:** table or column, type, nullable/default
- **Why:** …
- **Schema rule met:** 1, 2 or 3 (AGENTS.md § Schema rule)

## Ready for review (omp → master)
### Queued review refinement: tally alignment, wrapped chips, and review focus (2026-10-14)
Implemented the queued styling and keyboard-contract refinements: proposal tally counts now follow the chip; the open draft explorer is full-column up to `max-w-xl`; proposal chips keep move notation intact and wrap at separators; the reason Yes focus uses the theme focus ring; Hard-only saved state uses the primary button treatment with spaced, label-sized Enter kbd; keyboard comments distinguish saved advances from Good rating; review radii use `rounded-control` and a design-system track radius.

Checks: `npm run lint`, `npx tsc --noEmit`, `npm test` (791/791), and `NEXT_DIST_DIR=.next-test npm run build` passed. `npm run test:visual` and real-app screenshot capture were not run: the omp task context does not confirm that every `.env*` and shell `DATABASE_URL` points to localhost, so Playwright and the screenshot script (tsx/local app/API) are blocked under the no-database-without-localhost-confirmation rule. No screenshots captured or opened; `/api/review/queue` status was not observed.

Screenshot handoff: blocked pending explicit confirmation that all `.env*` database URLs and the shell `DATABASE_URL` are localhost. Once confirmed, capture and inspect the requested real-app states; required representative files are the 390px tally-open, checker draft-open, wrapped proposal chip, reason-yes-focus, and settled `review-hard-only-saved` PNGs in the new dated screenshot directory.
Implementation commit: `0ab1743` (`Polish queued forum and review refinements`).

### Review notes: responsive proposal chips and review-state screenshots (completed 2026-10-14)
Completed the follow-up on `omp/main`: checker chips wrap within a shared 34px-minimum chip shape with a board-view affordance; cube chips remain non-clickable, with the separator attached to the action. Tally counts now sit beside the chip as “1 vote” / “2 votes”; the proposal draft board grows at desktop. Review retry hints/radii use tokens, the Hard-only saved state uses the primary grade treatment with reserved bottom space, and its status uses sans text plus a kbd-only Enter hint. Corrected the successful reply-clearing comment, retained the full POST header with `{ body?, proposals? }` and `isAppWriteEnabled()`, expanded review keyboard/save-flow comments, and formatted Good/Easy buttons. Updated the reply API test mock to follow merged `prismaApp`/`isAppWriteEnabled()` exports. No schema, migration, Oracle, or `.env*` changes.

Captured the real local app/API at 390 and 1280 in light and dark under `design/screenshots/2026-10-13-review-followup-2/`. The `/api/review/queue` screenshots waited for HTTP 200. Opened and inspected these PNGs:
- `forum-write-post-5--390-dark--full.png`
- `forum-write-post-7--390-dark--full.png`
- `forum-write-post-5-tally-open--390-dark--full.png`
- `forum-write-post-5-checker-chip-focus--390-dark--viewport.png`
- `forum-write-post-5-checker-modal--1280-light--viewport.png`
- `forum-write-post-5-checker-draft-open--1280-light--full.png`
- `forum-write-post-7-cube-draft-selected--390-dark--full.png`
- `review-retry-front--390-dark--viewport.png`
- `review-hard-only-saved--390-dark--viewport.png`
- `review-hard-good-back--1280-light--viewport.png`
- `review-card1-reason-yes-focus--390-dark--viewport.png`
- `review-card1-reason-no-focus--390-dark--viewport.png`

Ready for main-session visual review; the review opens the representative files above. The main session also ran the previously unavailable suite after `.env.test` was added: `npm run test:visual` passed **15/15**.

Checks: `npm test` **791/791**, `npx tsc --noEmit`, `npm run lint`, `NEXT_DIST_DIR=.next-test npm run build`, and `npm run test:visual` passed.

Commits: `7224f45` implementation, `a57dfd4` queue/progress handoff.

### Queued review follow-up: keyboard contracts, proposal tally, and screenshots (2026-10-13)
Implemented on `omp/main`: restored the review keyboard-contract comments, hid grade hints from assistive technology, limited rating buttons by `ratingLimit`, added the reason key hint, and retained Hard-only saved state until Next card/Enter. Fixed current-card progress during the reason step. Forum tally construction carries proposal IDs/notation, dead checker/cube code and unused tally label are removed, the checker chip has a hover affordance, proposal drafts align to start, and the reply POST route header is restored. The reply-clearing comment was subsequently corrected in the responsive-chip follow-up.

Local test proposals were created through the real app API without modifying existing rows: post 5 / StudyPosition 6 — reply 8 / ForumMoveProposal 1, checker `hmfwATDEc/ABMA`; reply 9 / ForumMoveProposal 2, checker `hmfwATCoc/ABMA`. Post 7 / StudyPosition 8 — reply 10 / ForumMoveProposal 3, cube action `NO_DOUBLE`.

Captured 68 forum and 44 review screenshots from the real local app at 390/1280 in light/dark under `design/screenshots/2026-10-13-review-followup/`; recaptured all 44 review screenshots after the phase-aware progress fix. The obsolete `forum-write-replay-move2` files are absent.

Visual review: the main session opened and inspected all eight representatives plus the four corrected reason screenshots, with no visible Must/Should defects:
- `forum-write-post-5-checker-modal--390-light--viewport.png`
- `forum-write-post-5-tally-open--1280-dark--full.png`
- `forum-write-post-7-cube-draft-open--390-dark--full.png`
- `forum-write-post-5-checker-draft-open--1280-light--full.png`
- `review-card1-reason-question--390-light--viewport.png`
- `review-card1-reason-question--390-dark--viewport.png`
- `review-card1-reason-question--1280-light--viewport.png`
- `review-card1-reason-question--1280-dark--viewport.png`
- `review-retry-front--1280-dark--viewport.png`
- `review-hard-only-saved--390-dark--viewport.png`
- `review-hard-good-back--1280-light--viewport.png`

Two delegated visual-reviewer attempts did not return after receiving exact screenshot paths; the main session performed the image review instead. `npm test` passed (62 files, 759 tests), `npx tsc --noEmit`, `npm run lint`, and `NEXT_DIST_DIR=.next-test npm run build` passed. `npm run test:visual` exits before tests because `.env.test` is absent; it was left untouched.

The task remains in the queue for main-session review; no Oracle, schema, migration, or `.env*` changes.

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
- **Review notes on `omp/main` at `02831c2`**: responsive proposal chips, tally labels, retry/Hard-only styling, restored comments and real-app screenshot follow-up. Completed 2026-10-14; commit `7224f45`.
