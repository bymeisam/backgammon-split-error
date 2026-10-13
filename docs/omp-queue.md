# omp queue

Hand-offs between Claude Code (on `master`) and omp (on `omp/main` in `../backgammon-omp`). The rules are in AGENTS.md § Two worktrees, one local DB. Newest items at the top of each section. Mark an item done by moving it to "Done" with the date and commit.

## Tasks for omp

_No tasks currently._
### Review: note-aware second try and "Do you know the reason?" (queued 2026-10-13, after Phase 4)
Approved by the user. Independent of Phase 4 and of master: no schema or API change. Touches `app/review/`, `lib/reviewKeys.ts`, `lib/shortcuts.ts` (and their tests) only.

Today (`app/review/ReviewSession.tsx`): `choose()` grades locally; a wrong answer is saved as Again at once and the back (verdict, best move, options table, Yours/Best boards, note via `<ReviewNote>`) waits for "Next card"; a right answer shows the back with Hard/Good/Easy. The note is already in every card payload (`card.decision.note`, non-null = has a note) but only rendered on the back. Server rule (`lib/review/requests.ts` `ratingFor`): wrong → Again only; right → hard/good/easy. Wrong cards are requeued locally after 3 cards (`AGAIN_REQUEUE_AFTER_CARDS`).

New flow, **only for cards with a note** (cards without one keep today's behaviour exactly):
```
Right first time → "Do you know the reason?" (note hidden until answered)
    Yes → back with the note → Hard / Good / Easy
    No  → back with the note → Hard / Good
Wrong first time
    receiver card (take/pass, options.length === 2) → today's back → Next, saved as Again
    otherwise → "Not quite", show the note only (no best move, no loss) → try again,
                with the first choice shown crossed out and not selectable
        right → back → Hard only
        wrong → back with the best move → Next, saved as Again
```
- Save **once**, when the card's outcome is final, with the existing POST `/api/review/cards/[id]/answer` body (`chosen` = the final choice; `rating`). Don't save after the first wrong choice. A second-try success posts the correct `chosen` with `rating: "hard"`, which the server already accepts. The Hard-only and Hard/Good caps are enforced in the UI.
- `durationMs` covers the whole card, both tries included.
- Keep the save-failed "Retry saving" path working for every final state.
- Keyboard: update `reviewKeyAction` contexts in `lib/reviewKeys.ts` for the new steps (reason question Y/N, retry front) and the "?" list in `lib/shortcuts.ts`, with tests (`lib/reviewKeys.test.ts`).
- Checks: vitest, tsc, eslint, build, and the visual suite. Screenshots of each new state with `scripts/design-screenshots.ts` into `design/screenshots/<date>-review-second-try/`, checked by the visual-reviewer. Local test data has one review card with a note; add a second note or card locally if needed and say so.
- Add a PROGRESS.md entry, then an entry under "Ready for review".

### Phase 4, part 2: proposal APIs and real data (queued 2026-10-13)
Start after part 1. **First merge `master` into `omp/main`, then run `npx prisma generate`**: master's `adf2cdf` added `ForumMoveProposal` and enum `ForumCubeAction` (see prisma/schema.prisma), and they're already applied to the shared local DB.
- The reply create API (`app/api/forum/posts/[id]/replies/route.ts`) and edit API (`app/api/forum/replies/[id]/route.ts`) accept `proposals: [{studyPositionId, resultPositionId} | {studyPositionId, cubeAction}]`.
- Validate with part 1's helpers: the position belongs to the post and its kind fits the proposal; checker results must be reachable through `legalSequences`, and the server stores its own notation; cube actions must be allowed by `doubleOffered`. At most one proposal per position per reply (the DB unique key enforces it too).
- A reply needs text **or** at least one proposal. Editing a reply replaces its proposals. Deleting a reply removes them (FK cascade).
- Load proposals with the post (`app/forum/[id]/page.tsx`) and wire part 1's UI to real data: the chips in replies and the collapsed "Show proposals (n)" tally per position.
- Checks: tests for the APIs, tsc, eslint, vitest, build; screenshots with `scripts/design-screenshots.ts` checked by the visual-reviewer. Then add an entry under "Ready for review".
- **Review notes on part 1 (`421d419`), fold these into part 2:**
  - Use the generated Prisma enum `ForumCubeAction` instead of the hand-written `CubeAction` union in `lib/forumProposals.ts`, and move the cube labels (duplicated in `ProposalDraft.tsx` and `ProposalDisplay.tsx`) into one place. Use the app's usual cube wording: "No double", "Double/Take", "Double/Pass", "Too good/Pass", "Take", "Pass".
  - Sort the tally by count (highest first), then first-seen.
  - A cube proposal's chip shouldn't open a board modal (it would show the same position as the post); just show the action.
  - Remove the "Draft only" and "will not be saved yet" notices once saving works, and drop `required` from the reply textarea (text or at least one proposal, checked on submit and on the server).
  - Don't lose a completed but not yet "used" play silently when the proposal controls are closed: either keep it or make "Use this play" the obvious next step.
  - `page.tsx` decodes each position twice (`proposalPositions` and the render loop); decode once.

### Phase 4, part 1: helpers and UI, no DB (in progress, started 2026-10-13)
Given to omp directly. In short: `lib/forumProposals.ts` (`validateCheckerProposal` with doubles expanded to four dice, `cubeActionsFor`, a tally helper); an optional `onChange` callback on `CheckerMoveExplorer`; the UI pieces (propose controls in the reply composer, cube buttons for CUBE positions, a proposal chip that opens the board after the play, a collapsed "Show proposals (n)" panel), built against typed props.

## Schema requests (omp → master)

_Use this shape:_
- **Date / task:** …
- **Change:** table or column, type, nullable/default
- **Why:** …
- **Schema rule met:** 1, 2 or 3 (AGENTS.md § Schema rule)

## Ready for review (omp → master)

Branch `omp/main` at commit `421d419`; Phase 4 part 1 is ready for review. Added forum proposal drafts, typed proposal chips/tallies, pure validation and tests; no DB/API persistence. Checks: focused proposal tests 7/7, full suite 748/748, `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed. Forum screenshots were not run because the spec does not confirm that all `.env*` database URLs target localhost.

## Done
