# Snaps: orientation in two steps (2026-10-16, round 3)

Mockup: `design/mockups/2026-10-16-snaps-direction-arrows.html`.
- It has eight frames: 1280 and 390, light and dark, with step 1 active and with step 2 active. Each frame works on its own.
- The 1280 step 2 frames open with a hover preview on corner 2.

Scope: the Orientation card on `/snap-poc` (`app/snap-poc/SnapPocReview.tsx`, `app/snap-poc/snapPoc.styles.ts`), the builder board's new overlays (`app/components/match-analysis/Board.tsx` and `.styles.ts`, passed through `PositionBuilder`) and the mapping in `lib/snapPocLayout.ts`.

This is a proposal only. It replaces round 2, and the small direction diagram is gone.

## 1. The flow

```
ORIENTATION
(1) Make the board match the photo                never changes the game
    [Rotate board] [Swap colours]
    Turn and recolour the board until it looks like the photo.
    [Board looks right →]                                  (primary)
──────────────────────────────────────────────────────────────────
(2) Make the game right                                    sets the pips   (disabled)
    Analyzing for  [ Dark | Light ]
    Home board     [ 1 | 2 | 3 | 4 ]
    Confirm the board first.
    [⇆ Mirror checkers]
Save card: [Save as correct] (disabled)  "Finish step 2 to save: the game isn't set yet."
```

After "Board looks right →":
- Step 1's controls are disabled and its number becomes ✓.
- Step 2 is enabled, and focus moves to the selected corner number.
- Step 2 gains a legend ("● Dark to play · home board bottom-right (4)" and "○ Light · home board top-right (2)", `aria-live="polite"`).
- Step 2 gains a "← Change board view" button, which goes back to step 1.

Going back never changes the game. The game is stored in the photo's frame (§3), so Rotate in step 1 only renumbers the drawn corner (1↔4, 2↔3).

- **Order:** step 1 comes first because colour, direction and home board are hard to judge on a board that isn't drawn the way you read the photo.
- **Disabled controls** use native `disabled` (`disabled:opacity-40 cursor-not-allowed`, as in `shared.styles.ts`, and the same two classes on the segmented options). They show their current values, and a one-line hint says why they're off.
- **Save is only possible in step 2.** The Save card (`extraActions`) shows "Save as correct" disabled during step 1, with the reason "Finish step 2 to save: the game isn't set yet." linked by `aria-describedby`. In step 2 it reads "Saves this board and game." This replaces the trial-mode rule that disables Save while any control is inactive.
- **Mirror checkers** stays in step 2. It's a one-press action with no pressed state, and it moves the corner selection 1↔2 or 3↔4. It's in the game step because it moves checkers relative to the point numbers, which changes the pips: Dark goes from 129 to 162 on the mockup's photo.
- **Colour words:** Dark / Light, pending the user's decision (round 2's reasons are unchanged: it's the page's and the model's wording, and real sets aren't always black and white).

## 2. Home board on the big board

The numbers 1–4 are the corners of the board as drawn after step 1, in reading order: 1 top-left, 2 top-right, 3 bottom-left, 4 bottom-right. In step 2 the board shows small 1–4 badges in the four frame corners, so each number has a visible place. The selected badge is filled `board-number` and the others are outlined.

- **Hover or focus on a number** draws a wash over that quadrant (six points, one half of a row):
  - `focus` blue at 16 % fill, with a 2 px dashed `focus` outline;
  - blue is used because it's the app's focus colour, and it's neither a severity colour nor a checker colour;
  - at 16 % the checkers stay readable through it.
- **Touch (390):** there's no hover, but a tap selects and focuses the number, so the wash shows the selected quadrant. It clears on blur.
- **Selected home board:** a 4 px rail in the chosen colour's checker fill and rim, on the frame just outside the six points (the point-number strip side), with a small arrowhead toward the bear-off side.
  - The other colour's home gets the same rail at 45 % opacity on the other row, same side.
  - The rails sit off the bone, so they never cover a checker or meet the severity-coloured move arrows (`--arrow-*`, drawn over the points).
- **Board changes:** two optional props, e.g. `quadrantHighlight?: 1 | 2 | 3 | 4` and `homeRails?: { corner, side: "mine" | "opponent" }`, with `cornerLabels?: boolean`. Their geometry comes from `lib/boardGeometry.ts`. `PositionBuilder` passes them through, and the forum builder leaves them unset.

## 3. Mapping: drawn corner → `SnapOrientation`

The step 1 view is `R` = Rotate. The drawing never moves in step 2: step 2 changes only the numbers, the owners, the pips and who is to play. The inputs are colour C and drawn corner K′ = (rowD, sideD).

- `rotated` = R. It's step 1's flag, the same as `toggleRotate`'s.
- `bottomColor` = C when rowD is bottom, otherwise `other(C)`. The colour whose home is on the drawn bottom row is `mine`.
- `viewHome(o)` must equal sideD, so `bottomHome` = R ? flip(sideD) : sideD.
- Builder `homeLeft` = (sideD === "left"), which is `viewHome(o) === "left"`. Because `pointAt` follows Board's drawing for the same home side, each photo column stays on the same screen column whatever the corner.
- Builder `playerToMove` = rowD bottom ? "mine" : "opponent". The builder already has this field (`lib/positionBuilder.ts:15`), so "Analyzing for" a colour drawn at the top needs no redraw.
- `swapCheckerColors` = (bottomColor === "light") !== Swap colours, so the photo's colours are the default.

| R | K′ (drawn) | `bottomColor` | `bottomHome` | `rotated` | `playerToMove` | Dark's home in the photo |
|---|---|---|---|---|---|---|
| off | 1 TL | light | left | false | opponent | top-left |
| off | 2 TR | light | right | false | opponent | top-right |
| off | 3 BL | dark | left | false | mine | bottom-left |
| off | 4 BR | dark | right | false | mine | bottom-right |
| on | 1 TL | light | right | true | opponent | bottom-right |
| on | 2 TR | light | left | true | opponent | bottom-left |
| on | 3 BL | dark | right | true | mine | top-right |
| on | 4 BR | dark | left | true | mine | top-left |

The table is for Analyzing for Dark. For Light, swap the colours in `bottomColor`.

I checked the table against `pointAt` / `layoutToBuilderState`:
- **R off, 4:** `pointAt("bottom", i, "right")` = 12 − i, so point 1 is at photo bottom-right.
- **R off, 1:** `mine` = light with home bottom-left, so dark (the opponent) has its home on the other row, same side: top-left.
- **R on, 4:**
  - The layout is read turned 180°, with `viewHome` = flip(left) = right, so dark's point 1 lands at screen bottom-right.
  - Screen bottom-right is photo top-left, which matches round 2's corner-1 case (`{dark, left, rotated}`).
- **R on, 2:** `viewHome` = right, so `mine` = light has its home at screen bottom-right, which is photo top-left. Dark is on the same side, other row: screen top-right, photo bottom-left.

**What's stored:** `bottomColor`, `bottomHome` and `rotated` as today, plus one new optional field, `analyzingFor?: "light" | "dark"`.
- `SnapLayout` has no player to move, and C can't be read back from the other three fields.
- An absent field means `bottomColor`, so old truths load unchanged.
- This is a JSON truth file, not a DB column.
- The page reads back K′ for C as: row = (C === bottomColor ? bottom : top), side = `viewHome(o)`.

**Actions on that state:**
- **Mirror checkers** = `toggleMirrorCheckers`.
- **Rotate** = `toggleRotate`. It keeps the game, and the drawn corner renumbers 1↔4, 2↔3.
- **Changing "Analyzing for"** keeps the game and moves the corner selection to the other colour's home: C's home flips to the other row, same side, so Dark 4 becomes Light 2. My reasoning: changing whose turn it is shouldn't silently change who owns which checkers. See open question 3.

**Goes away:**
- `toggleMirrorNumbers`, `isCheckersMirrored`, `mirroredNumbers` as an input (ignored on load), and the "iAm" / "mirrorNumbers" control keys;
- `effectiveOrientation`, once the steps replace the trial stages.

Pips for the mockup's photo (Dark/Light, by Dark's home in the photo): bottom-right 129/132 (the real game), bottom-left 162/183, top-right 246/243, top-left 213/192.

## 4. One convention to flag

Backgammon tools draw the player to move at the bottom. With the drawing fixed in step 1, Analyzing for a colour whose home is in corner 1 or 2 puts the mover at the top. I kept the drawing (that's the point of step 1) and added a quiet nudge in step 2 for that case: "Dark is at the top of this board. Most tools draw the player to move at the bottom. *Turn the board so Dark is at the bottom*". It's a link that runs `toggleRotate`. That changes the view only, the game stays, and the corner renumbers.

## 5. Open questions

1. **Dark/Light or Black/White?** This is still the user's call.
2. **Mover at the top:** is the step 2 nudge (§4) enough, or should the board turn automatically when step 2 puts the analysed colour at the top? Turning automatically breaks "step 1 fixes the drawing".
3. **Changing "Analyzing for": keep the game, or keep the corner?** The mockup keeps the game and moves the corner number to the other colour's home. Keeping the corner number would change who owns which checkers.
4. **The new `analyzingFor` field** on `SnapOrientation` and in the truth files (§3): OK?
5. **Staged rollout:** stage 1 (view only, 7ee4b56) is step 1 with "Board looks right →" hidden. Should Mirror checkers still arrive later, as a disabled button in step 2?
6. **Screenshots:** I couldn't see the mockup rendered (the designer runs nothing). Please screenshot it, and check the wash and the faint rail in the Midnight Felt and Quiet Ink themes, before the spec.
