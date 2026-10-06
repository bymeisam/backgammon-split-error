# Spaced-repetition review: facts from the data (2026-10-06)

These are the investigator's findings for planning the Anki-style review feature, checked against local `app_dev` and the live Galaxy API. Oracle was not queried. Most statistics come from a 60k-row sample (Decision ids 100001–120000, 600001–620000 and 1200001–1220000).

## Checker candidates (`raw.reviews[0].result.result.moves[]`)
- **Fields per candidate:** `notation`, `rank`, `equity`, `equity_error` (loss vs rank 1, 0 for the best move), `move_played`, `probabilities` (win/gammon/backgammon, plus mwc in match play), `error_analysis`, and `final` (`xgid`, `gnubgid`). Verified against the live API.
- **Candidate counts:** 1 to 5, never more. Of counted decisions, 3 candidates is most common (15k of 24k), then 4 or 5 (about 4k each), then 2 (about 1.1k). Single-candidate rows are forced moves and are never counted.
- **The played move:** always in the list, exactly once. In 4-candidate lists it is often appended as rank 4. That rank is probably a position in the list, not the engine's true rank (inferred only).
- **`equity_error` is usable directly** as "loss vs best". Two caveats:
  - 375 sampled candidates have a positive `equity_error`, so `rank` is not strictly ordered by equity.
  - The decision-level `equity` and `rawError` columns don't always match the candidates. The normalized shape should read the candidates themselves.
- **Equity basis:** inferred cubeful and cube-normalized. Not stated by Galaxy.
- **Type gap:** `CandidateMove` in `lib/gameReviewsTypes.ts:68` lacks `equity_error`.

## Cube analysis (`raw...cube_analysis`)
- **Fields:** `no_double`, `double_take`, `double_pass`, `optimal`, the `diff_*` fields, `doublers_best_action` and `receivers_best_action`. Values are from the point of view of the player making the decision. The receiver's event has the doubler's values negated.
- **Stored labels:** `cubeActionBest` holds only `roll`/`double` and `take`/`pass`. Galaxy never sends "too good" or "no double/take" in stored data.
- **Deriving the full action:** the five-way classification (No double/take, Double/take, Double/pass, Too good/pass, Too good/take) would have to be worked out from the three equities.
- **Most cube rows aren't real decisions:** about 578k of 670k are pre-roll checks with `countAsDecision = 0`.
- **Who is deciding:** the row's `userId` is the player acting. On `cube_double` rows that's the doubler; on `cube_pass` rows it's the receiver.
- **Redoubles:** shown by `cubeOwnerUserId = userId` on `cube_double` rows. But `cubeConfident = 0` on about 22% of rows, where the cube walk missed a take. `raw.reviews[0].source_match.formatted_value` (a GNU Match ID) decodes the cube value and owner, and agrees 100% with the rows where `cubeConfident = 1`. It looks able to repair the other 22%.

## Whose decisions, and the board
- **/mistakes shows both players' decisions:** it has no `userId` filter. "Me" is resolved through `PlayerIdentity.isMe` (`lib/playerIdentity.ts`).
- **The board draws the player on roll at the bottom.** For the user's own checker plays and doubles, the user is already at the bottom.
- **Bug (pre-existing):** on take/pass rows the stored position is in the doubler's frame, so the doubler is drawn at the bottom, while the cube owner is relativized to the receiver. Board and cube disagree on the user's own take/pass decisions.

## Sizes (local)
- **`Decision` today:** about 4.48 GB data and 285 MB index. Average `raw` size is 3.6 KB for checker rows and 1.7 KB for cube rows.
- **A compact normalized JSON column:** about 270 B per checker row (about 490 B with probabilities), and about 120 B per cube row.
- **Total:** roughly 170–370 MB, which is 4–8% on top of the current data.

## Hook points
- **Ingest:** add one `decisionData` field in `lib/ingest.ts`, around lines 480–530.
- **Backfill:** no existing pattern fits a value computed per row in TypeScript. It needs id-range batching with per-row updates.
