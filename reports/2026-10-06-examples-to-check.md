# Examples to check on Galaxy (2026-10-06)

These are cases where we suspect the app shows something wrong, or where the data is ambiguous. Each one has a question to answer after looking at the same spot on Backgammon Galaxy. Write your answer on the **Answer:** line. We fix things from these answers, starting with A and B (the cube bugs).

## Conclusions from the user's answers (2026-10-06)

| Item                                 | Verdict                                                                                                                                                                                                     | What happens next                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A.** Cube value/owner              | **Bug confirmed.** Galaxy's cube matched the GNU Match ID in all 5 examples (A1 2-cube on the opponent's side, A2 and A3 a 4-cube on mine, A4 a 2-cube on mine, A5 a redouble). Our take-walk misses these. | Read the cube value and owner from the match ID (`source_match.formatted_value`). Fix ingest, then backfill.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **B.** Take/pass orientation         | **Confirmed.** Galaxy draws the receiver (me) at the bottom on my take. Our app draws the doubler. In the replay, the "fixed perspective" box already covers it.                                            | Single-decision views (/mistakes, review cards) draw the decision-maker at the bottom, with the cube consistent. To be confirmed with the user.                                                                                                                                                                                                                                                                                                                                                                                     |
| **C.** Lower rank beats rank 1       | Galaxy shows the stored rank order (rank 1 first) even when a lower-ranked move's equity is slightly higher.                                                                                                | Sort candidates by equity. Grading uses a loss threshold, so these tiny gaps count as correct. To be confirmed.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **D.** Equities beyond ±3            | **Not a bug.** These are last moves where a gammon or backgammon is likely. Galaxy shows the same values (it displays the loss relative to the best move).                                                  | None.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **E.** Error vs played move mismatch | Galaxy lists the played move first, but its own error data calls it a blunder against a better rank-2 move. 124 old cases.                                                                                  | The equity sort (C) makes the best move and the error agree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **F.** Played move as "rank 4"       | **Not a bug.** Galaxy shows your move even when it isn't in the top 3.                                                                                                                                      | None. Sorting places it correctly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **G.** Too good                      | Deferred by the user.                                                                                                                                                                                       | Implement the "too good" rule as written below, with a tie rule. Discuss the money-game mismatch later.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **H.** Game scores                   | **Bug confirmed.** 47816592 game 4 starts opp 4 – me 2 on Galaxy (stored me 4 – opp 2). 45282503 game 2 starts me 1 – opp 0 (stored me 0 – opp 1).                                                          | Follow-up check: `metadata.scores` isn't keyed by colour. `white` is the score of the **player on roll**, and `black` is the other player's. Ingest read it from the opponent's first move, which caused the swap. The user is black in only about half of their matches. The GNU Match ID (`source_match.formatted_value`) has absolute scores: player 1 is always black. Decoded with the user's colour, it has 0 inconsistencies across 1,965 matches, while a plain swap leaves 2 bad ones. Fix: take scores from the match ID. |

**How to find each example**

- **On Galaxy:** we don't know Galaxy's review URL format. Open the match by its id and game, then find the move by **roll and move played**. Galaxy's move numbers won't match ours: our replay's "Move N of M" also counts automatic "did not double" checks. If you copy one Galaxy review URL from your browser, the links here can be generated.
- **In our app:** `http://localhost:3000/matches/<match>/replay/<game>`, at the "Move N of M" given. Restart the dev server first if you haven't since the notes change.

All findings come from the local DB (stored data). None have been checked against Galaxy yet.

---

## A. Cube value or owner probably wrong

On these decisions, the app's cube tracking missed a take (`cubeConfident = 0`), so **no cube is drawn at all**. Galaxy's own GNU Match ID, stored in the raw data, says a bigger cube was in play. This affects about 22% of decisions, almost all of them in money games and older matches.

**A1 (mine).** Match 45282503 vs cbj2, 5-point, game 2. My roll 2-4, played `24/22 9/5*`. App: `/matches/45282503/replay/2`, Move 10 of 25.

- Ours: no cube drawn.
- Match ID: a 2-cube owned by the opponent.
- **Question:** What cube does Galaxy show here, and who owns it?
- **Answer:** in events array item 27 i see event_type double_requested, and then in reviews.result you can see reviews, and next item says double_accepted
  after take it shows a 2 on his side
  **A2 (mine, take).** Same game, Move 16: the opponent redoubles and I take.
- Ours: no cube drawn.
- Match ID: a 2-cube owned by the opponent, so this is a redouble to 4. After my take we store a 2-cube; the match ID says a 4-cube owned by me.
- **Question:** Is this a redouble to 4, and is the cube at 4 after my take?
- **Answer:** again same this, item 50 i see double requested, and then next item has double accepted and here again you have reviews
  after a take it shows a 4 on my side
  what i see in those two, is that whenever its my decision for cube action, reviews comes with it, but it actually works for both, so in A1 irequested double so the review object is there, in second one A2 he requested double no reviews but my decisoin which was take in this case has review

**A3 (opponent).** Same game, Move 25: the opponent resigns.

- Ours: a 2-cube owned by me.
- Match ID: a 4-cube owned by me.
- **Question:** What cube value does Galaxy show when the opponent resigns?
- **Answer:** its 4 on my side

**A4 (opponent).** Match 30873806 vs equs, money game, game 2. Opponent's roll 6-3, played `24/18 13/10*`. App: `/matches/30873806/replay/2`, Move 17 of 68.

- Ours: no cube drawn, for about 50 steps of this game.
- Match ID: a 2-cube owned by me.
- **Question:** Was there an earlier double that I took? What cube does Galaxy show here?
- **Answer:** items 28/29 in events same here he requested and I accepted, both has reviews after this there is a 2 on my side

**A5 (mine).** Same match, game 5, Move 28: I double. App: `/matches/30873806/replay/5`.

- Ours: cube 1, centred.
- Match ID: a 2-cube owned by me, so this is a redouble to 4.
- **Question:** Initial double, or redouble to 4?
- **Answer:** yes, there was on doublerequested before and now another double in the same game basically means a redouble

## B. Take/pass boards drawn from the doubler's side

On every take/pass decision, the stored position is the doubler's. So the app draws the **doubler** at the bottom as "me", even when the decision is mine as the receiver. The cube owner, meanwhile, is worked out from the receiver's side, so on a redouble the cube appears on the wrong side.

**B1 (mine, take, redouble).** Match 47771999 vs yigitbostanci, 7-point, game 2. App: `/matches/47771999/replay/2`, Move 27 of 51.

- I took. Galaxy's best is pass (error −0.737).
- The app shows the opponent's checkers at the bottom in my colours, and the cube at the top.
- **Question:** On Galaxy, whose checkers are at the bottom for my take, and which side is the cube on?
- **Answer:** it shows me at the bottom, this is only important if i am reviewing the whole game,we have already added a tick box to fix positions if we want,

**B2 (mine, pass).** Match 47756005 vs torremats, 7-point, game 2. App: `/matches/47756005/replay/2`, Move 39 of 39.

- I passed. Galaxy's best is take (error −0.934).
- **Question:** Same as B1. Also, does Galaxy grade this pass as a −0.93 blunder?
- **Answer:**

**B3 (mine, take, centred cube).** Match 47523684 vs good_match, 5-point, game 3. App: `/matches/47523684/replay/3`, Move 10 of 37.

- I took. Galaxy's best is pass (error −1.487).
- **Question:** Is Galaxy's board drawn from my side or the doubler's?
- **Answer:**

**B4 (opponent, pass).** Match 47406300 vs wpd, 7-point, game 6. App: `/matches/47406300/replay/6`, Move 39 of 39.

- The opponent passed. Galaxy's best is take (error −1.315). Here the app shows me (the doubler) at the bottom.
- **Question:** Whose checkers are at the bottom on Galaxy?
- **Answer:**

**B5 (opponent, take, redouble).** Match 47592521 vs keithobear, 7-point, game 1. App: `/matches/47592521/replay/1`, Move 29 of 52.

- The opponent took. Galaxy's best is pass (error −0.760). I own a 2-cube.
- **Question:** Which side does Galaxy draw the cube on?
- **Answer:**

## C. A lower-ranked move has a better equity than rank 1

This is rare: 148 in about 95k checker decisions, and the gaps are usually tiny.

**C1 (opponent).** Match 46875560 vs ruduggy, 7-point, game 4, roll 4-2. App: `/matches/46875560/replay/4`, Move 56 of 71.

- Ranks: 1 `8/6* 5/1` 0.4995 · 2 `20/18 8/4` 0.4877 (played) · 3 `20/14` **0.5058**.
- **Question:** In what order does Galaxy list these, and which does it call best?
- **Answer:** it shows the same order as here

**C2 (opponent).** Match 47406300 vs wpd, game 5, roll 3-2. App: `/matches/47406300/replay/5`, Move 28 of 30.

- Ranks: 1 `6/4 6/3` −0.9331 · 2 `20/15` −0.9558 (played) · 3 `6/1` **−0.9286**.
- **Question:** Same as C1.
- **Answer:** same order as here

**C3 (mine, money).** Match 5818762 vs rogmo, game 1, roll 3-6. App: `/matches/5818762/replay/1`, Move 66 of 67.

- Ranks: 1 `12/6 11/8` −1.4629 (played) · 2 `12/9 11/5` −1.4629 · 3 `12/6 4/1` **−1.4611**.
- **Question:** Does Galaxy rank `12/6 4/1` first?
- **Answer:** no, 12/6 11/8 is first

**C4 (mine, money).** Match 5643381 vs river7, game 2, roll 3-6. App: `/matches/5643381/replay/2`, Move 79 of 79.

- Ranks: 1 `15/6` −2.4673 (played) · 2 `15/9 4/1` −2.4673 · 3 `15/9 5/2` **−2.4635**.
- **Question:** Same as C3.
- **Answer:** 15/6 is the first

## D. Equities beyond ±3

A loss can't be worse than −3 (a backgammon) unless equity is multiplied by the cube value. There are 45 such cases.

**D1 (opponent).** Match 47810783 vs naplesguru, 7-point, game 4, roll 3-6. App: `/matches/47810783/replay/4`, Move 39 of 39.

- Cube 1 (confident). Ranks: 1 `bar/16` −1.9135 (played) · 2 `bar/22 18/12` −3.1504 · 3 `bar/22 11/5` −3.1504.
- **Question:** What equities does Galaxy show for ranks 2 and 3?
- **Answer:** it shows them the same here, it just, it shows the first,one as -1.913, but second one and third one as (-1.237) which is basically same thing shows it as this is by this amout worse, but you are right technically it says its a backgammon

**D2 (mine).** Match 46858521 vs ruthless2184, 7-point, game 4, roll 6-4. App: `/matches/46858521/replay/4`, Move 41 of 41.

- Cube 2 (confident). Ranks: 1 `7/3 7/1` −2.9817 · 2 `7/1 6/2` −2.985 · 3 `7/1 5/1` −2.9851 · 4 `24/14` −3.0015 (played).
- **Question:** Does Galaxy show these as about −3, or about −1.5 per cube?
- **Answer:**

**D3 (mine, money).** Match 5407320 vs greenor, game 1, roll 5-2. App: `/matches/5407320/replay/1`, Move 39 of 40.

- Cube unknown. Ranks: 1 `23/21 23/18` −2.4881 (played) · 2 `23/18 8/6` −2.6119 · 3 `23/21 6/1` −3.0327.
- **Question:** What's the real cube value here, and what does Galaxy show for rank 3?
- **Answer:**

**D4 (opponent, money).** Match 6029407 vs slm06, game 3, roll 4-1. App: `/matches/6029407/replay/3`, Move 58 of 58.

- Cube unknown. Ranks: 1 `21/17 13/12` −3.0699 (played) · 2 `13/12 6/2` −3.09 · 3 `6/5 6/2` −3.0951.
- **Question:** Same as D3.
- **Answer:**

- all these moves are last moves so these numbers telling you that you gonna be gammoned or backgammoned

## E. The decision's error doesn't match the played move's error

There are 124 cases, all in older matches. In some of them, the app shows "played = best" next to a BLUNDER badge.

**E1 (mine).** Match 33015498 vs gonzy, 5-point, game 7, roll 1-3. App: `/matches/33015498/replay/7`, Move 21 of 38.

- Error −0.309 (BLUNDER). Played `17/14*/13` is rank 1, but rank 2 `17/14* 4/3*` is +0.309 better.
- **Question:** Does Galaxy call this a blunder, and which move does it list as best?
- **Answer:** yes galaxy shows the first one as first, but the data shows the first move as bluder

**E2 (mine).** Same match, game 2, roll 2-2. App: `/matches/33015498/replay/2`, Move 23 of 27.

- Error −0.245 (BLUNDER). Played `7/1 4/2` is rank 1, but rank 2 `20/16(2)` is +0.245 better.
- **Question:** Same as E1.
- **Answer:** you are right

**E3 (opponent).** Same match, game 1, roll 1-3. App: `/matches/33015498/replay/1`, Move 34 of 57.

- Error −0.364. Played `6/2` is rank 1, but rank 2 `7/3` is +0.364 better.
- **Question:** Same as E1.
- **Answer:**

**E4 (opponent).** Match 34360175 vs notebook383, 5-point, game 2, roll 2-1. App: `/matches/34360175/replay/2`, Move 23 of 46.

- Error −0.004, but the played move `5/2` is rank 3, at −0.029 against the best.
- **Question:** What error does Galaxy show for `5/2`: −0.004 or −0.029?
- **Answer:**

-- we need to make a decision here, probably we need to do a sort based on equity and dont accept the moves array as it is

## F. The played move added at the end of the list as "rank 4"

This is the normal pattern, seen in 897 of 902 recent cases. We think Galaxy keeps a top-3 list and appends your move if it isn't among them.

**F1 (mine).** Match 47816592 vs hamidesmaeilii, 5-point, game 1, roll 3-3. App: `/matches/47816592/replay/1`, Move 2 of 38.

- Ranks: 1 `24/21(2) 13/10(2)` · 2 `8/5(2) 6/3(2)` · 3 `24/21(2) 6/3(2)` · 4 `13/10(2) 6/3(2)` (played, −0.037).
- **Question:** Does Galaxy list your move as 4th best, or as "your move" shown apart from a top-3 list?
- **Answer:**

**F2 (mine).** Same game, roll 4-1, Move 14.

- Ranks: 1 `9/5 6/5` · 2 `9/5 8/7` · 3 `10/5` · 4 `24/20 21/20` (played).
- **Question:** Same as F1.
- **Answer:**

**F3 (opponent).** Same match, game 2, roll 5-4. App: `/matches/47816592/replay/2`, Move 12 of 68.

- Ranks: 1 `20/11` · 2 `6/1 5/1` · 3 `20/16 13/8` · 4 `13/4` (played).
- **Question:** Same as F1.
- **Answer:**

**F4 (opponent).** Same game, roll 2-1, Move 31.

- Ranks: 1 `13/11 8/7*` · 2 `24/22 8/7*` · 3 `8/7*/5` · 4 `23/21 8/7*` (played).
- **Question:** Same as F1.
- **Answer:**
- ok it shows my move although its not amongst top 3, whats the issue here, i think we can work with it

## G. Cube actions under our "too good" rule

**The rule** is worked out from the doubler's side. ND = no double, DT = double/take, DP = double/pass (always 1).

1. The receiver should take if DT ≤ DP, and pass otherwise.
2. Double if min(DT, DP) > ND. The answer is Double/take or Double/pass.
3. Otherwise:
   - if ND > DP: **Too good** (Too good/pass, or Too good/take).
   - if not: **No double/take**.

**In match play it lines up with Galaxy.** Galaxy's "roll" always falls under No double or Too good, and "double" always under Double/take or Double/pass. The only exceptions are 14 exact ties, which Galaxy labels inconsistently, so we need a tie rule. Galaxy's `too_good_meaningful` flag is **not** the same as "too good". It's also true on most Double/pass rows.

**In money games Galaxy's labels look wrong.** It says "roll" on 99.6% of the positions our rule calls Double, yet it still charges an error for not doubling. See G-money below.

| Rule says      | Whose | Where (match, game, replay move) | Played / Galaxy best | ND    | DT    | **Question:** what does Galaxy say? | **Answer:** |
| -------------- | ----- | -------------------------------- | -------------------- | ----- | ----- | ----------------------------------- | ----------- |
| Too good/pass  | mine  | 47524384 g2 Move 53              | no double / roll     | 1.065 | 1.200 |                                     |             |
| Too good/pass  | mine  | 47524384 g2 Move 55              | no double / roll     | 1.021 | 1.068 |                                     |             |
| Too good/pass  | opp   | 47815958 g3 Move 24              | no double / roll     | 1.016 | 1.073 |                                     |             |
| Too good/take  | mine  | 47373113 g3 Move 20              | no double / roll     | 1.007 | 0.932 |                                     |             |
| Too good/take  | opp   | 47524859 g4 Move 24              | no double / roll     | 1.022 | 0.962 |                                     |             |
| No double/take | mine  | 47816592 g2 Move 18              | no double / roll     | 0.182 | 0.042 |                                     |             |
| No double/take | opp   | 47816592 g1 Move 7               | no double / roll     | 0.294 | 0.135 |                                     |             |
| Double/take    | mine  | 47816592 g4 Move 2               | doubled / double     | 0.177 | 0.264 |                                     |             |
| Double/take    | opp   | 47815958 g1 Move 15              | no double / double   | 0.669 | 0.780 |                                     |             |
| Double/pass    | mine  | 47812751 g2 Move 19              | doubled / double     | 0.812 | 1.007 |                                     |             |
| Double/pass    | opp   | 47816592 g2 Move 67              | doubled / double     | 0.910 | 1.100 |                                     |             |

For the "too good" rows, the key question is whether Galaxy shows "Too good / pass" (or "take"), or just "No double".

**G-money1 (mine).** Match 30873806, game 5, Move 22. App: `/matches/30873806/replay/5`.

- Rule: Double/take (ND 0.587, DT 0.820).
- Galaxy's stored best is "roll", yet the error is −0.234 for not doubling.
- **Question:** What does Galaxy's review say was the right cube action, and does it count this as an error?
- **Answer:**

**G-money2 (opponent).** Match 30873806, game 4, Move 14. App: `/matches/30873806/replay/4`.

- Rule: Double/pass (ND 0.798, DT 1.040).
- Galaxy's stored best is "roll", error −0.202.
- **Question:** Same as G-money1.
- **Answer:**
- lets leave this for later, just put some logic there for too good to double, we'll disciuss it later

## H. Stored game scores look swapped (found along the way)

Each game's stored score has me and the opponent swapped. As stored, 1,146 of 1,995 match-play matches have a score that goes _down_ between games. With the scores swapped back, only 2 do. The cause looks like `lib/ingest.ts:473-474`, which reads `metadata.scores.black` as the acting player's score when it seems to be the opponent's. The UI doesn't show this score today.

**H1.** Match 47816592 ends me 2 – opp 5, but game 4 is stored as starting at me 4 – opp 2.

- **Question:** On Galaxy, what is the score at the start of game 4?
- **Answer:** where did you get this number from? galaxy says he is 4 I am 2

**H2.** Match 45282503: in game 1 I doubled and the opponent passed, but game 2 is stored as starting at me 0 – opp 1.

- **Question:** What's the score at the start of game 2?
- **Answer:** its me 1 he is 0 again tell me where you got these number from

## I. Old analyses: cube checks when the opponent owns the cube (added 2026-10-06)

**Result:** the user was right. In old analyses (null `metadata.scores`), every pre-roll check where the opponent owns the cube is `countAsDecision = 0`. That's 74,934 rows, 36,127 of them the user's. Galaxy's verdict on all of them is "roll" with no error, and the app hides them everywhere. Only the raw DT number is a hypothetical value. So these rows don't make the old cube analysis wrong, and no flag is needed.

**A different, real issue:** on about 18k _counted_ old-analysis cube rows, Galaxy's `doublers_best_action` (and so our `cubeActionBest`) says "roll" even though `rawError` grades not-doubling as an error (13,525 rows). On 4,614 more, it says "roll" for doubles graded as no error. This is the same thing behind G-money. C2 below is the example to check.

**E1 (mine, hidden).** Match 29939852, 5-point, game 1. I'm black. The opponent has taken my double. This is my pre-roll check before I roll **2-1** and play `24/23 22/20` (replay Move 22 of 99).

- Match ID: a 2-cube owned by the opponent, score 0–0.
- Stored: ND 0.358, DT 0.464, best "roll", no error, not counted. The live API matches.
- **Question:** Does Galaxy show any double/no-double analysis for you before this 2-1? Is the cube a 2 on the opponent's side?
- **Answer:** no analysis, there nothing for cube

**E2 (mine, hidden).** Match 30111427, 7-point, game 2. I'm white. Before my **1-3**, played `24/23 24/21` (Move 15 of 40).

- Match ID: a 2-cube owned by the opponent, me 1 – opp 0.
- Stored: best "roll", no error, not counted.
- **Question:** Same as E1.
- **Answer:** same thing, no cube analysis shown, basically just roll means we go on, nothing to decide

**E3 (mine, hidden).** Match 30120378, 5-point, game 1. Before my **5-2** in the bear-off, after the opponent's `3/0ff 2/0ff` (around Move 77 of 82).

- **Question:** Does Galaxy show any cube analysis for you here?
- **Answer:**

**C1 (contrast, mine, I own the cube, counted).** Match 32699544, 5-point, game 1. I'm white. Before my **5-3**, played `18/15 7/2*` (Move 45 of 50).

- Stored: ND 0.786, DT 0.890, best "double", not redoubling graded BLUNDER −0.104.
- **Question:** Does Galaxy say you should have redoubled here (about −0.10)?
- **Answer:**

**C2 (key example, mine, centred cube, counted).** Match 29939852, game 1. I'm black. Before my **5-2**, played `Bar/18*` (Move 14 of 99).

- Stored: ND 0.792, DT 0.975, DP 1. Galaxy's best is "roll", but not doubling is graded BLUNDER −0.183. Our app shows "did not double / best: roll" with a BLUNDER badge, which contradicts itself.
- By the numbers it's Double/take, so the grade is right and the "best" label is wrong.
- **Question:** Does Galaxy say you should have doubled here? Which action does it show as best?
- **Answer:**
