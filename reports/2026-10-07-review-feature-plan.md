# Spaced-repetition review: plan (approved 2026-10-07)

**Goal:** turn decisions, mainly the user's blunders, into flashcards. A card shows the position and asks for the play, then reveals the answer, the equities and the user's note, and schedules the next review with FSRS. It's built local-first; the Oracle steps come after the user's manual check.

The data findings behind this plan are in `reports/2026-10-06-spaced-repetition-facts.md` and `reports/2026-10-07-galaxy-client-comparison.md`.

## Decided so far
- **The card:** one card is one `Decision`. Any player's decision can be added, one at a time or in bulk; bulk add takes everything in the current filter.
- **Answers:** picked from a list of options. Answering on the board is in the ideas file for later.
- **Checker options:** all candidates, which is 3–5 moves and always includes the move actually played. They're sorted by equity, with Galaxy's rank breaking exact ties, and shown in shuffled order.
- **Cube options, for the doubler:** No Double, Double / Take, Double / Pass, Too good / Pass, Too good / Take. **For the receiver:** Take or Pass.
- **Cube grading:** an answer is correct if its doubling part loses ≤ 0.02 and its take/pass part is right. If take and pass are within 0.02 of each other, either take/pass part counts.
- **Correct answer:** within 0.02 of the best. That's Galaxy's good/error boundary.
- **Grading:** a wrong answer counts as Again automatically. A right answer is rated Hard, Good or Easy by the user.
- **Scheduling:** FSRS. A card answered Again comes back in the same session.
- **Notes:** shown on the back of the card, and editable there.
- **Tags:** free-form, attached to the decision (like notes), with suggestions from tags already used. Review by tag, or by the existing filters (phase, checker/cube, severity).
- **Loading:** cards load in batches of 20, with a "N remaining" count.
- **Daily limits:** 20 new cards and 200 reviews. These live in a settings file (`lib/settings.ts`) for a future settings page.
- **Bulk add:** at most 100 cards per click, with a confirmation, skipping decisions that are already cards.
- **Removing cards:** both delete and suspend.
- **Board:** the decision-maker is drawn at the bottom, as everywhere else.
- **Moves column:** a source-neutral analysis column on `Decision`, filled by a per-source translator at sync time, plus a backfill for counted decisions only.

## Phase A: normalized analysis column (data only)
1. **New column `Decision.analysis Json?`** with a versioned, source-neutral shape:
   - `{ v: 1, kind: "checker", candidates: [{ move, rank, equity, loss, probs }] }`, where `candidates` is sorted by equity, `loss` is relative to the best move, and `probs` holds win, win gammon, win backgammon, lose gammon and lose backgammon.
   - `{ v: 1, kind: "cube", role: "doubler" | "receiver", nd, dt, dp }`, stored in the doubler's view, so the sign fix for receiver rows happens once, here.
2. **A Galaxy translator:** `lib/analysis/galaxy.ts` turns `raw` into that shape. Ingest fills the column. Other sources, such as XG, would each get their own translator later.
3. **Backfill:** `scripts/backfill-decision-analysis.ts`, with a `--dry-run`, for counted decisions only (about 600k rows), batched by match like the existing backfills.
4. **Docs and tests:** `docs/field-mapping.md` documents the shape and the translator, with unit tests on real examples (C1–C4 for rank against equity, F1 for the played move as rank 4, cube rows, and the receiver-sign rows).

## Phase B: review feature
1. **Schema:**
   - **`ReviewCard`:** `decisionId` unique, plus the FSRS state (due, stability, difficulty, reps, lapses, state, last review) and `suspended`.
   - **`ReviewLog`:** one row per answer, recording the option chosen, whether it was correct, the loss, the rating, the time, and the state before.
   - **`Tag`:** a unique `name`.
   - **`DecisionTag`:** links decisions to tags.
2. **The FSRS library:** use an existing implementation, likely `ts-fsrs`; the developer verifies its current API first. Limits and thresholds live in `lib/settings.ts`.
3. **Writes** go behind the existing write-mode check, like notes. On the live site, cards and tags are read-only.
4. **UI:**
   - **Wherever a board shows a DB-backed decision** (not /galaxy): an "Add to review" button and a tag editor, next to the note.
   - **/mistakes:** "Add all to review" for the current filter, with the cap and a confirmation.
   - **/review:** a session page.
     - **Front:** the board, with the decision-maker at the bottom, plus a question header ("Your move", "Double?", "Take or pass?"). The wording is always second person, even for an opponent's decision; the user is learning to make that decision themselves (decided 2026-10-07).
     - **Back:** "Correct" or "Incorrect", Played vs Best, every option with its loss, the note, then the rating buttons.
     - **End of session:** an accuracy % and streak summary.
   - **/review/cards:** a card list filtered by tag, phase and type, with suspend, unsuspend and delete.
5. **Docs:** the status notes, docs and PROGRESS.md.

## Oracle (after the user's manual check)
- **After phase A:** the migration, then the analysis backfill with a dry run first.
- **After phase B:** the migrations. Cards are created locally, so a cards-and-tags export/import like the notes scripts could follow if it's needed.

## Phase A01: revision (approved 2026-10-07)
The analysis is **not stored**. `getDecisionAnalysis()` derives it on demand from the untouched `raw`, through the translator for the match's source. Ingest only *checks* that every counted checker or cube decision translates, and warns when one doesn't. The `Decision.analysis` column, its migration and the backfill were removed before reaching Oracle, so the Oracle step for Phase A disappears. Phase B's cards call `getDecisionAnalysis` when they're shown.
