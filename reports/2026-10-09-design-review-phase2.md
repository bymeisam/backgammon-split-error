# Design review: Phase 2 (Quiet Ink, Midnight Felt), commit b93aa58

Screenshots: `design/screenshots/2026-10-09-phase2/{clubroom,quiet-ink,midnight-felt}/`, abbreviated below as `qi/`, `mf/` and `cr/`.
References: `reports/2026-10-08-design-review.md` §2 B and C, `design/mockups/directions.html` (`.ink`, `.felt`).
Contrast figures are hand-computed WCAG relative luminance. They're good to about ±0.05.

## Clubroom: unchanged (confirmed)

`git diff b93aa58^ b93aa58 -- app/themes/clubroom.css` is empty. The only styling edits are the six phase-1c fixes: `home.styles.ts` (dueHeld), `review.styles.ts` (optionTag, grade band), `reviewCards.styles.ts` (positionSegment), `galaxyMatches.styles.ts` (numeric cells) and the AppNav badge source. `cr/dashboard--1440-light--full.png` matches phase 1c. `cr/review-card1-back-correct--390-dark--viewport.png` shows the new sticky band and the option tag on its own line.

## (a) Per theme

### Quiet Ink: faithful, good

Every token matches the `.ink` swatches (`quiet-ink.css:15-87` against `directions.html:76-83`).

- **Dashboard** (`qi/dashboard--1440-{light,dark}--full.png`): calm, precise, and the strongest "analytics tool" read of the three. The indigo badge and the black/white primary are both correct.
- **Replay** (`qi/replay-checker-error-move2--1440-*`): light is excellent. In dark, see (b): the board arrows go brown and bottle-green.
- **Review front and back** (`qi/review-card1-back-correct--1440-*`, `qi/review-card2-back-incorrect--1440-dark`, `qi/review-card1-front--390-dark`): clean. "Correct." and "Not quite." render as a sans oblique (see the open question on Geist italic). It works, but it has less character than Clubroom's Newsreader italic.
- **Mistakes and cards** (`qi/mistakes-checker-blunders--1440-light--viewport.png`, `qi/review-cards--390-dark--full.png`): scannable, and the 390 wrap fix holds.
- **Mobile menu** (`qi/nav-menu-open--390-light--viewport.png`): fine.
- **Titles at weight 500:** "Dashboard" reads slightly soft next to the swatch sheet's 600. That's acceptable, and the fix is optional (needs approval).

### Midnight Felt: faithful in mood, and the developer's adjustments improve it

- **Dashboard** (`mf/dashboard--1440-{light,dark}--full.png`, `mf/dashboard--390-light--full.png`): luxurious without hurting scanning. The champagne primary in dark and the felt-green primary in light both work.
- **The one real defect is Playfair Display's default old-style figures.** Numbers set in the serif lack `lining-nums`, so they bounce on the baseline:
  - the repeat counts `92× 49× 45× 43×` (`mf/dashboard--1440-light--full.png`, `app/home.styles.ts:85`);
  - the PR stats `5.20 / 5.34 / 3.28` (`mf/match-detail-47816592--1440-dark--viewport.png`, `app/components/match-analysis/MistakesSection.styles.ts:29`);
  - `app/repeated-positions/repeatedPositions.styles.ts:38`.

  `bigNumber` (`home.styles.ts:20`) already has `lining-nums`, which is why the rating looks right.
- **Replay** (`mf/replay-checker-error-move2--1440-{dark,light}--viewport.png`, `--390-dark--viewport.png`): the board is handsome. Brass numbers on walnut are legible, and the light arrows on felt are the best arrows of all three themes.
- **Review** (`mf/review-card1-front--1440-light`, `mf/review-card1-back-correct--1440-dark`, `mf/review-card2-back-incorrect--1440-dark`, `mf/review-card1-back-correct--390-light`): "Not quite." in Playfair italic is lovely, and the green Good button in light is a nice touch.
- **Mistakes and cards** (`mf/mistakes-checker-blunders--1440-dark--viewport.png`, `mf/review-cards--1440-light--full.png`): fine. The champagne selected-row bar doesn't fight Error.
- **Mobile menu** (`mf/nav-menu-open--390-dark--viewport.png`): fine.

## (b) Severity readability

- **Chips:** these use Galaxy's fills, identical in every theme, so they're always readable.
- **Move text:** uses the `*-ink` tokens, which are identical to Clubroom's and pass.
- **Felt light accent:** #5F5530 is clearly apart from Error ink #8F5F00.
- **Felt dark accent:** champagne #C8B48A is clearly apart from #FBBD23 (`mf/replay-…-1440-dark`, the Error chip next to the Start review button).

### Arrows

| Theme | Verdict |
|---|---|
| Felt, both modes | Pass, with the hues intact. The halo sits on felt, so light Galaxy shades work. Blunder #FF889B reads pink rather than red, but it's needed: raw #F43E5C is about 1.9:1 over the halo on an ivory point. **Accept.** |
| Quiet Ink, light | Pass. |
| Quiet Ink, dark | **Fails recognisability.** The bone #9EA3AC (L≈0.36) is so dark that a 3.5:1 arrow has to be near-black. Error #654300 reads as brown and Best #09543A as bottle-green (`qi/replay-checker-error-move2--1440-dark--viewport.png`, `qi/review-card1-back-correct--1440-dark--viewport.png`). Fix 2 lifts the bone to about Clubroom-dark brightness, so the arrows can keep their hue. |
| Over dark points (Quiet Ink, Clubroom) | The halo is bone at 75% opacity (`BoardPanel.styles.ts:88`), so over a dark point the arrow's background darkens and contrast falls to about 2.4–2.7:1. Fix 3 (an opaque halo) solves this in every theme at once. |

### Felt's dark checkers on felt (the open question)

- The fill contrast against the felt (about 1.4:1 dark, 1.6:1 against oxblood) is acceptable on its own. The fill doesn't have to carry the edge, because the rim and the turned ring do. Real felt boards look this way, and the screenshots read fine at a glance.
- **The rim is too weak, though.** Rim #6E6A5E measures:
  - 2.3:1 on dark felt;
  - 2.0:1 on dark oxblood;
  - **1.96:1 on light-mode felt.**
- **Change the rim to #9A9584**, a warm pewter. It measures:
  - 4.2:1 on dark felt and 3.65:1 on dark oxblood;
  - 3.5:1 on light felt and 3.1:1 on light oxblood;
  - more than 7:1 on the walnut bar.

  That satisfies WCAG 1.4.11 for the checker's edge in every case. **Keep the fill #17191C.**

## (c) Developer's deviations

| Deviation | Verdict |
|---|---|
| QI dark arrows darkened to about 3.5:1 | **Change.** The bone is the constraint, not the arrows (fix 2). |
| Titles at weight 500 in every theme | **Accept for now.** A per-theme weight is listed under "needs approval". |
| Felt light ink-faint #636D66 | **Accept.** 4.6:1 on paper. |
| Felt light accent #5F5530 (olive brass) | **Accept.** 6.4:1 on paper, and distinct from Error ink. |
| Felt dark accent and primary #C8B48A (champagne) | **Accept.** It separates from Error better than the sheet's #C9A45C and still reads as brass. |
| Mine rim #6E6A5E in light too | **Accept the idea, change the value.** #9A9584 in both modes (fix 1). |
| Light arrows on the dark felt | **Accept.** The correct call, since the felt is dark in both modes. |
| Blunder arrows lifted (#FFA3B2 light, #FF889B dark) | **Accept.** Needed over the halo on ivory points. |

## (d) Fixes before Phase 3

All of these are token or class edits, with no new tokens.

1. **Felt mine rim (S).**
   - `app/themes/midnight-felt.css`: `--checker-mine-rim: #9a9584;` in the light block, the dark block and the system block (three places).
2. **Quiet Ink dark board (S).**
   - Both dark blocks of `app/themes/quiet-ink.css`, kept identical:
     ```
     --board-bone: #b4b8bf;        /* L≈0.48, about Clubroom-dark brightness */
     --board-point-light: #959aa3; /* darker than bone, mirroring light mode; 1.4:1 to bone */
     --board-point-dark: #4a505b;  /* unchanged */
     --arrow-best: #0b6b48;        /* 3.3:1 on bone */
     --arrow-good: #4e5d72;        /* 3.4:1, same as light */
     --arrow-error: #835500;       /* 3.2:1, still reads amber/ochre */
     --arrow-blunder: #b01a35;     /* 3.4:1 */
     ```
   - Re-screenshot `qi/replay-*-dark` and `qi/review-card1-back-correct-*-dark` to confirm. The white checkers lean on their rim #7A7F89 a little more, as they already do in light mode.
3. **Opaque arrow halo (S, touches every theme including Clubroom).**
   - `app/components/match-analysis/BoardPanel.styles.ts:88`: in `arrowHalo`, change `opacity-75` to `opacity-100`. The arrow then always sits on a solid bone (or felt) casing. That fixes the sub-3:1 case over dark points in Quiet Ink and Clubroom, and makes fix 2's figures hold everywhere.
   - It's a small visual change to approved Clubroom, so **the user should OK it.** Without it, fix 2 alone still gives the arrows their hue back.
4. **Lining figures in the serif (S).** Add `lining-nums` to:
   - `app/home.styles.ts:85` (`repeatTimes`);
   - `app/repeated-positions/repeatedPositions.styles.ts:38` (`occurrenceCount`);
   - `app/components/match-analysis/MistakesSection.styles.ts:29` (`statValue`).

   It's harmless in Clubroom and Quiet Ink.

### Needs approval (new tokens)

- **`--theme-display-weight`:** 500 for Clubroom and Felt, 600 for Quiet Ink, used by every `font-serif … font-medium` title entry (e.g. `PageShell.styles.ts:48`, `shared.styles.ts:36`, `review.styles.ts:21,32,117`, `AppNav.styles.ts:18`). It restores the swatch sheet's Quiet Ink hierarchy. Low priority.
- **Optional `--theme-emphasis-style`** (`italic` or `normal`) for the verdict word and "vs". Quiet Ink would use `normal`, because a sans oblique is weaker than an upright word in Best or Blunder ink. Low priority. Decide it after confirming whether Geist italic is real or synthesised.

## (e) Verdict

**Both themes are good enough to offer in Settings once fixes 1, 2 and 4 are in.** Fix 3 is recommended, pending the user's OK.

- **Midnight Felt** turned out better than I predicted in October. The developer's colour changes resolved my concerns about severity collisions, and its arrows are the most legible in the app.
- **Quiet Ink** is the most legible for long sessions in light mode. Its dark board needs fix 2 before it ships.
- **Clubroom** remains the right default.

## Open questions

- **Geist italic:** the build may synthesise it. `next/font` Geist may not ship an italic face. Check what `layout.tsx` loads, or check on screen.
- **Not reviewed:** I didn't look at every state. The status, shortcuts and repeated-positions screens weren't opened in the two new themes.
- **Unverified fixes:** fix 2's values are computed, not seen. They need a re-screenshot.
