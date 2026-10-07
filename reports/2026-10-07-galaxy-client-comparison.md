# Galaxy web client vs our implementation (2026-10-07)

**Source:** Galaxy's compiled Flutter web build in `galaxy-source/` (gitignored, local reference only), read by the investigator. All findings come from the client code. None were checked against Galaxy's live API or site.

## Confirmed: ours matches Galaxy
- **GNU Match ID layout:** Galaxy's decoder reads the same bit ranges as `lib/gnuMatchId.ts`. Player 0 = white (Galaxy "player1"); player 1 = black.
- **Data sources:** Galaxy's review takes cube, scores, match length and turn from the Match ID. It never uses `metadata.scores` or `match_length`.
- **Cube verdicts:** Galaxy works the verdict out from the equities on screen. It never shows `doublers_best_action`/`receivers_best_action`, `too_good_meaningful` or `cube_decision_meaningful` in the game review. So the "stuck at roll" labels never appear on Galaxy's site.
- **Doubler rule:** "Too good" if ND > 1, otherwise "Double" if DT > ND, otherwise "No Double". The doubling vs no-double split and the DT == ND tie both match ours.
- **Receiver rule:** "Pass" if DT < DP (on the receiver-view values), otherwise "Take". This matches ours, including DT == DP → Take.
- **Severity:** comes straight from `error_severity`, as ours does.
- **Dice:** no dice on double, take and pass steps.
- **Candidate moves:** shown in the API's order, never re-sorted. The played move is marked by `move_played`. "BEST" is the first candidate whose `equity_error` > −0.001.
- **Per-move grading thresholds:** best > −0.001, good > −0.0199, error > −0.0799, otherwise blunder. Our planned 0.02 "counts as correct" threshold for review cards matches Galaxy's good/error boundary.

## Differences
1. **ND == DP tie.** Galaxy needs ND > 1 strictly for "Too good", so ND == DP gives "Double" when DT > 1. Ours gives Too good/pass. Example: 662455.
2. **Too good split.** Galaxy shows only "Too good". It never adds take or pass after it, and never says "Redouble" in reviews.
3. **Badge source.** Our "Doesn't match Galaxy" badge compares against `*_best_action`, which Galaxy's own site doesn't display.
4. **Cube on take/pass.** Galaxy draws the offered (doubled) value centred on the receiver's side. Ours keeps the current value on the doubler's side, and the step label carries the offer.
5. **Orientation.** Galaxy always puts the viewer (the account owner) at the bottom. Ours puts the decision-maker at the bottom outside the replay's fixed perspective.
6. **Dice on no-double checks.** Galaxy attaches the check to the `dice_rolled` event and shows the roll. Ours shows no dice.
7. **"Doubtful" severity.** Galaxy displays it as "Good", a mild tier. Ours folds it into "error".
8. **Non-negated `cube_pass` rows.** Galaxy doesn't correct the sign on these, so its receiver label would be inverted on the 4 such rows. Ours handles them.
9. **Hidden analysis.** Galaxy hides the no-double analysis ("Analysis is not available") in the Crawford game, in 1-point matches, when the opponent owns the cube, and when the cube is dead.

## New facts
- **Review URL:** `https://www.backgammongalaxy.com/play/page_analysis_match_details?match_id=<sourceMatchId>`. It is match-level only, with no game or move parameter.
- **`finished_at`:** `GET /api/matches/{id}` returns a `finished_at` field. That could be a real play date, contradicting the doc's "no date source exists". Not yet checked live.
- **Match ID bit 66:** Galaxy reads and writes it as a flag. Its meaning is unresolved.
- **No even-length rule:** Galaxy has no "even length = money" rule. It uses the length raw, falling back to the match API's `length` when it's 0. Our rule is our own heuristic, neither confirmed nor contradicted.

## Cube wording and error presentation (second pass)

**Cube labels Galaxy shows, by event**

| Event | PLAYED chip | BEST chip | Table rows |
|---|---|---|---|
| `dice_rolled` check | "No Double". "Too good" if ND > DP and severity is none/doubtful. | "Too good" if ND > DP, otherwise "Double" if DT > ND, otherwise "No Double". | No Double / Double/Take / Double/Pass |
| `double_requested` | "Double" | same as above | same as above |
| `double_accepted` | "Take" | "Take" or "Pass" (Pass if the receiver-view DT < DP) | No Double / Take / Pass |
| `double_rejected` | "Pass" | same as above | same as above |

- **Words Galaxy never uses in reviews:** "Redouble" (RushGammon only), "Beaver", "Too good to double", or a "Too good/take" / "Too good/pass" split.
- **Casing:** "Double/Take" is title case, but "Too good" has a lowercase g.
- **Our extra detail:** our best labels add the take/pass half (Double/take, Too good/pass…), and our replay sentence says who doubled and whether it was a redouble. Galaxy shows the take/pass half only as the BEST tag on a cube-table row.
- **Tie rows:** 542 counted local rows have ND == DP. Galaxy shows "Double" for them.

**Cube rows in Galaxy's lists:** there are no dice anywhere in its game log. Double, take and pass rows instead start with a small square holding the cube value (the offered value on double/take/pass). The square is coloured by severity: amber for error, red for blunder, blue otherwise. A checker row whose cube check was an error gets a trailing cube square.

**Severity names and colours:**
- none: "Best", green #36D399
- doubtful: "Good", slate #65758B
- error: "Error", amber #FBBD23
- blunder: "Blunder", red #F43E5C

**Blunder pages ("My Blunders"):**
- A "Recent Blunders" card, then 17 position categories with counts. The categories use the same keys as our `Decision.classification`, with Galaxy's display names (e.g. "Blitz, early" where ours says "Early Blitz").
- Blunders can be deleted.
- The detail view reuses the review board, with prev/next and "Open in setup position".
- Only blunders are listed. There are no date, severity or opponent filters.

**Training features:**
- **Lessons:** a choice list, then "Confirm", then an analysis text.
- **RushGammon:** binary swipe questions ("Your Roll": Double vs No Double; "Opponent Doubled": Take vs Pass; "Your Move": Best vs Blunder), with Accuracy % and Streak at the end.
- **Puzzles:** answered on the real board, showing Correct/Incorrect, a rating change, and "Played: X" / "Best: Y". Puzzles deliberately avoid repeating recent positions.
- **No spaced repetition** exists anywhere in the client.

**Match stats:** per player:
- Error Rate
- Decision Stats: Best/Good/Error/Blunder counts, Equity Loss and MWC Loss
- Checker Play and Cube Play split out the same way, e.g. "Error 3 (0.12)"
- Luck
