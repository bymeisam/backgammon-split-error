# Snaps prompt evaluation log

## Purpose

Snaps reads a backgammon board from a photo with Gemini. This log tracks
each prompt version and how well it reads the boards, so a prompt change is
judged on numbers, and a regression on any photo shows. One section per
version; never edit a published prompt, add a new version instead.

## How to run

- Ask Gemini (cached per run, 7 s between calls, stops on HTTP 429):
  `npx tsx scripts/snaps/snap-poc.ts --model gemini-3.8-flash --prompt v2`
  (`--prompt` defaults to the newest version in `scripts/snaps/prompts.ts`;
  answers go to `snap-poc/results/<model>/<version>/<image>.json`, gitignored).
- Enter the truth for new photos on `/snap-poc` (dev only; truth is one file
  per photo, `snap-poc/truth/<image>.json`, shared by every run).
- Score: `npm run snaps:score` prints the tables below (per photo set from
  `scripts/snaps/photo-sets.ts`, plus a per-photo table of which runs were
  perfect).

## Scoring definitions

All from `lib/snapPocScore.ts` (`scoreSnap`), comparing the answer to the
truth as read (no mirror/flip credit).

- **Photos scored**: answers that have a truth file, parse errors included.
- **Perfect board**: all 24 points (colour and count), the bar, the trays,
  the dice and the cube right.
- **All 24 points**: every point right; the bar, tray, dice or cube may still
  be wrong. (The 2026-10-15 review called this "perfect".)
- **Points avg /24**: mean of points with the exact colour and count; a parse
  error counts as 0.
- **Dice**: same values, order-insensitive. **Bar**, **Tray**: both colours'
  counts exact. **Cube**: same value and location (a hidden or centred cube
  counts as 1 in the centre).
- **Parse errors**: answers that were not valid JSON or failed
  `validateSnapLayout`.

Photo sets: **set1** = the 10 original photos (truth entered 2026-10-15),
**set2** = the 19 screenshots of 2026-10-16 (stream frames, a product shot:
clocks, score cards, cube on the bar), **all** = every photo.

## v1

- Date: 2026-10-15 (set1); 2026-10-16 (set2 answers).
- Model: gemini-3.8-flash.
- What changed: the first version.
- Known result on set1 from the user's review on 2026-10-15, confirmed by
  `snaps:score`: misses were mostly stack counts, weakest the real phone
  photo (`PXL_20260927_142233229.jpg`, 20/24) and a sideways shot
  (`Screenshot_20261015-111159~2.jpg`, 17/24).

| Set | Photos scored | Perfect board | All 24 points | Points avg /24 | Dice | Bar | Cube | Tray | Parse errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| set1 | 10 | 2/10 | 4/10 | 21.9 (91%) | 8/10 | 10/10 | 10/10 | 9/10 | 0 |
| set2 | 18 | 6/18 | 16/18 | 23.8 (99%) | 9/18 | 18/18 | 17/18 | 16/18 | 0 |
| all | 28 | 8/28 | 20/28 | 23.1 (96%) | 17/28 | 28/28 | 27/28 | 25/28 | 0 |

set2 answers: 18 of 19 (`Screenshot 2026-10-16 at 11.41.53 am.png` missing:
the run hit HTTP 429 on it), no parse errors, every one "high" confidence.
Truth for set2 entered by the user on 2026-10-16.

Reading (2026-10-16): set2 is much easier than set1 for the same prompt.
These are clean, square-on stream frames with few tall stacks, while set1
has the real phone photo, sideways shots and taller stacks. On set2 the
points are nearly solved (16/18 with all 24 right; the two misses are
22/24); the main miss is dice (9/18), then tray (16/18). So a better score
on set2 says little about stack counting; compare prompt versions per set,
and treat set1 (and future real phone photos) as the test that matters.

## v2

- Date: 2026-10-16 (prompt written); partial runs 2026-10-16 evening (6
  answers) and 2026-10-17 07:14 (2 answers, then HTTP 429). 8 of 28 photos
  answered so far.
- Model: gemini-3.8-flash.
- What changed vs v1: v1 plus a "Counting stacks" section, nothing else:
  - If a checker in a stack shows a printed number (as many apps and stream
    overlays draw for tall stacks), use that number as the stack's count.
  - Count a stack by counting the visible checker rims from the edge of the
    board toward the middle; checkers may overlap or be drawn in a second
    layer on top of the first.
  - Self-check before answering: for each colour, points + bar + borne off
    must equal 15. If it doesn't, recount the tallest stacks first and fix
    them; only if it still doesn't add up, say so in notes.
  - Clocks, score cards, player names and other overlays are not part of the
    board; ignore them except to avoid confusing them with checkers or dice.

| Set | Photos scored | Perfect board | All 24 points | Points avg /24 | Dice | Bar | Cube | Tray | Parse errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| set1 | 1 | 0/1 | 0/1 | 20.0 (83%) | 1/1 | 1/1 | 1/1 | 1/1 | 0 |
| set2 | 7 | 3/7 | 5/7 | 23.6 (98%) | 5/7 | 7/7 | 6/7 | 6/7 | 0 |
| all | 8 | 3/8 | 5/8 | 23.1 (96%) | 6/8 | 8/8 | 7/8 | 7/8 | 0 |

Partial: the set totals above aren't comparable with v1's full tables. The
fair comparison is the same 8 photos under both versions (`snaps:score`
per-photo table, 2026-10-17):

| Photo | v1 points | v2 points | v1 perfect | v2 perfect |
| --- | ---: | ---: | :---: | :---: |
| `PXL_20260927_142233229.jpg` (set1, real phone photo) | 20 | 20 | | |
| `11.37.11` | 24 | 24 | | |
| `11.38.43` | 22 | 22 | | |
| `11.43.00` | 24 | 24 | ✓ | ✓ |
| `11.43.23` | 24 | 23 | | |
| `11.44.39` | 24 | 24 | | ✓ |
| `11.47.48` | 24 | 24 | ✓ | |
| `11.49.57` | 24 | 24 | | ✓ |
| **Total** | **186/192** | **185/192** | **2/8** | **3/8** |

Reading (2026-10-17, 8 photos, too few to decide):
- **Stack counting, the thing v2 targets, hasn't moved.** Points are the
  same on 7 of 8 photos, and one lost a point (`11.43.23`, 24 → 23). The
  hard photo that matters (the real phone photo, `PXL_…`) is still 20/24.
- **The 15-checker self-check doesn't catch the errors.** On `PXL_…` v2's
  notes say "both sets of 15 checkers are accounted for", yet 4 points are
  wrong. Miscounts that move checkers between points still add up to 15,
  and the borne-off count is derived as 15 minus the board, so a missed
  checker becomes "borne off" without any warning. A sum check can't see
  either kind of error. Next step: check the borne-off tray as read against
  15 minus the board (already a v3 idea).
- **Perfect boards went 2 → 3**, from the non-point fields (dice, cube,
  tray). `11.47.48` lost its perfect board on dice (v1 read 5-2 correctly;
  v2 says "approximately 4 and 1"). That's noise from dice reading, not
  from the counting rules.
- **Latency:** two calls took 116 s and 129 s, against v1's 60 s and 23 s
  on the same photos. The other six took about the same time as under v1.
  Possibly slow responses on a congested free tier rather than the prompt;
  watch it in the full run.

**Quota (operational lesson).** The 2026-10-17 run hit HTTP 429 after 2
calls, and Gemini said "retry in 3h43m". So the free tier's 20 requests a
day is a rolling ~24 h window, not a midnight reset, and the previous
evening's calls (including the 13 HTTP 503 "high demand" failures, which
count) were still in it. From now on the run is wrapped so it stops after 3
503s in a row as well as on a 429. With 20 requests a day and 20 photos
left, finishing v2 needs either billing on the key or one clean full day.

## Findings for the next versions (2026-10-16, from v1 vs truth)

### Dice (v1 missed 11 of 28)

- **A single loose die read as a roll (4):** `11.37.11`, `11.38.18`, `11.47.15`, `11.48.05`. The truth has no dice. A lone die (in a cup or tray, or left on the board) isn't a roll to play.
- **Pips misread (7):** 5-5 read as 3-1, 6-6 as 6-3, 6-3 as 6-1, 5-2 as 5-1, 3-2 as 4-3, 4-4 as 3-1 and 4-1 as 3-1. Doubles were read as non-doubles twice. These are mostly small, angled or stylised dice.
- Ideas for a dice version: a roll is two dice together on the playing area; ignore a single die anywhere; count the pips one by one on each die; if the two dice look alike, check whether it's a double.

### Cube (user's rule, 2026-10-16)

Where the cube sits says who owns it and whether a double is pending:
- **In the middle on the bar showing 64 (or 1):** centred, nobody owns it, value 1.
- **On the playing area (on a player's side of the board, not the rail or tray), or in the middle showing 2, 4, 8 …:** a double has been **offered** and not yet answered. Nobody owns it yet; the receiver must take or pass. So the photo is a cube decision, not a checker move.
- **On the side (the rail or bear-off tray) by one player:** that player owns it at that value.

Neither the answer format (`center` / `top` / `bottom` / `unknown`) nor the truth can express "offered" or a rail or tray position yet. Some truths may record an offered cube as centred (e.g. `11.37.11`: Gemini saw an 8 near the centre bar, truth says centred 1). The scoring counts any centred cube as 1. This needs a format change (cube state: centred / owned + side / offered + receiver side), a toggle on `/snap-poc` (the board can already draw an offered cube; the builder's `doubleOffered` is always false today), and the truths rechecked. It's a schema change to the answer, so it goes into a new prompt version, not v2.
