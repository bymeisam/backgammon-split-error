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
| set2 | pending truth for set2 (user enters it on /snap-poc) | | | | | | | | |
| all | pending truth for set2 (user enters it on /snap-poc) | | | | | | | | |

set2 answers: 18 of 19 (`Screenshot 2026-10-16 at 11.41.53 am.png` missing:
the run hit HTTP 429 on it), no parse errors, every one "high" confidence.

## v2

- Date: 2026-10-16 (prompt written; not run yet).
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
| set1 | pending: not run yet (Gemini free-tier quota hit HTTP 429 on 2026-10-16) | | | | | | | | |
| set2 | pending truth for set2 (user enters it on /snap-poc) | | | | | | | | |
| all | pending truth for set2 (user enters it on /snap-poc) | | | | | | | | |
