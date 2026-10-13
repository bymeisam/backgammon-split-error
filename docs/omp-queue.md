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


### Phase 4, part 1: helpers and UI, no DB (completed 2026-10-13)
Implemented in commit `421d419`; its part 2 persistence and review notes are now integrated below.

## Schema requests (omp → master)

_Use this shape:_
- **Date / task:** …
- **Change:** table or column, type, nullable/default
- **Why:** …
- **Schema rule met:** 1, 2 or 3 (AGENTS.md § Schema rule)

## Ready for review (omp → master)
### Phase 4, part 2: proposal APIs and real data (2026-10-13)
Implemented on `omp/main`; reply routes validate text-or-proposal, attachment ownership and kind, legal checker results, cube actions, and per-reply duplicate positions. Create and replacement edits are transactional; body-only edits preserve existing proposals. Replies display persisted chips and per-position count-sorted tallies. Uses generated `ForumCubeAction`, shared exact labels, non-modal cube chips, decoded-position reuse, client submit validation, and retained checker drafts.

Verification: targeted reply/proposal tests passed; full Vitest **756/756**, `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed. `npm run test:visual` could not run because `.env.test` is absent (left untouched). Forty forum screenshots captured under `design/screenshots/2026-10-13-forum-proposals/`; manually inspected the 390px light post page. The reviewer checked file presence only, not image contents.
Commit: `322b9a2`.

## Done
