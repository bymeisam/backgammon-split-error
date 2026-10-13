# Forum branch design review (`omp-forum`), 2026-10-13

Scope: the forum list, post 6 (built position), post 5 (from a match decision), the move explorer (selected and moved), new post (empty and prefilled), the position builder, the replay's "Post to forum" button, and Clerk sign-in. Source: `design/screenshots/2026-10-13-forum/`. I looked at all 1280-light and 390-light shots and both read-only and write variants. In dark mode I checked only the explorer, because its highlights are a colour risk. Everything is judged against `docs/design-system.md` (§5 components, §7 do/don't, §8 accessibility).

## Read-only check: passed

With writes off, none of these screens shows a write control:
- **List:** no "New post" (`forum-readonly-list--1280-light`).
- **Posts:** no Edit, Delete or reply composer on post 5 or post 6 (`forum-readonly-post-6--1280-light`).
- **New post:** shows "Posting is turned off on this deployment." (`forum-readonly-new-empty--1280-light`).
- **Position builder:** no "Post to forum" (`forum-readonly-position-builder--1280-light`).
- **Replay:** only "Fixed perspective" (`forum-readonly-replay-move2--1280-light--viewport`).

The move explorer still appears in read-only mode. That's correct, because exploring a position isn't a write.

## What holds

These backgammon conventions hold on every board:
- point numbering from the bottom player's view, with the home board bottom-right;
- the decision-maker at the bottom;
- the higher die first (6-4, 2-1);
- the centred cube showing 1;
- both bear-off trays with their counts.

The replay's "Post to forum" is a secondary compact button next to "Fixed perspective". It is calm and in the right place at 1280. At 390 it drops to its own row, which is fine.

---

## Must fix before merge

**M1. The board is cut off at 390 on forum posts and in the position builder.** Severity: blocker.
- **Seen in:** `forum-write-post-6--390-light--full`, `forum-write-post-6-explorer-selected--390-light--viewport`, `forum-write-position-builder--390-light--full`.
- **What's wrong:** the board stops at point 19/20. The home board, dice, bear-off trays and the "Used/Remaining" readout are off-screen, behind a horizontal scroll inside the panel. The replay at 390 (`forum-write-replay-move2--390-light--full`) shows the same SVG scaling to fit, so the minimum width isn't needed.
- **Fix:**
  - `app/forum/forum.styles.ts:17-18`: delete `boardViewport: "min-w-[562px]"` (or make it `"w-full"`), and remove `overflow-x-auto` from `position`.
  - `app/position-builder/positionBuilder.styles.ts:11-12`: the same change (`boardWrap: "w-full"`, `boardViewport: "w-full"`).
  - Also drop the `p-2` on `position` below `sm` (`p-0 sm:p-2`), so the board gets the full 390px the way the replay's `bleed` board does.

**M2. Sign-in at 390: the Clerk card overflows its frame, and there's a card inside a card.** Severity: major.
- **Seen in:** `auth-sign-in--390-light--full` and `auth-sign-in--1280-light--full`.
- **What's wrong:**
  - At 390, Clerk's own card sticks out about 18px past the right edge of the app's wrapper card.
  - At both widths there are two nested frames, each with its own border and shadow, which §5 Card rules out ("Not a card inside a card").
  - Clerk's white surface, bold sans heading and gradient button don't match the paper/serif look.
- **Fix:**
  - `app/sign-in/[[...sign-in]]/page.tsx:16-23`: remove the wrapping `<div className={style.card}>` and delete `card` from `app/sign-in/signIn.styles.ts:10`.
  - Pass Clerk an `appearance` prop. Its `elements` class strings go in `signIn.styles.ts`: `rootBox: "w-full"`, `cardBox: "w-full max-w-full rounded-card border border-line shadow-card"`, `card: "bg-surface"`, `headerTitle: "font-serif text-ink"`, `formButtonPrimary: "bg-primary text-on-primary shadow-none"`.
  - Before relying on `variables` (`colorPrimary`, `colorBackground`, `fontFamily: "inherit"`), check that the installed `@clerk/nextjs` accepts CSS variables there. If it doesn't, use only `elements`.
  - `shell` (`signIn.styles.ts:3`): add `min-w-0`.
  - Separately, the card title says "Sign in to backgammon" while the brand line above it says "Game Review". Rename the application in the Clerk dashboard to "Game Review" (that's a user step, not code).

**M3. The explorer's highlights are drawn on top of the checkers and wash them out. The landing-point highlight is weak.** Severity: major.
- **Seen in:** `forum-write-post-6-explorer-selected--1280-dark--viewport`, `forum-write-post-6--1280-light--full`, `forum-write-post-6-explorer-selected--1280-light--viewport`.
- **What's wrong:**
  - In dark mode, the dark checkers on 24, 13, 8 and 6 look greyed and translucent next to normal ones, which hurts the two-colour distinction.
  - In light mode, the source tint (`accent/20`) shows only on light points, as a muddy taupe that reads as "disabled". On dark points (13) it's invisible.
  - The selected point's outline runs through the middle of the checker stack.
  - The landing point (`primary/20`, ink at 20%) is the same greyish tone as a source.
- **Cause:** `Board.tsx` (about line 398) draws the `interactiveTarget` polygons after the checkers and arrows, and `BoardPanel.styles.ts:68,77,78` put fill and stroke on those same polygons.
- **Fix:**
  - Keep the hit polygons on top but always transparent: `interactiveTarget` gets no fill or stroke, only the focus stroke.
  - Add a separate highlight layer between the points and the checkers in `Board.tsx`, fed by the same `interactivePointClassName`.
  - In `BoardPanel.styles.ts`, change the three looks to:
    - `interactiveSource`: no fill; a 3u accent bar along the point's base edge (or `stroke-accent/70` on the point outline only).
    - `interactiveSelected`: `fill-accent/30` under the stack.
    - `interactiveDestination`: a dashed "ghost checker" circle (`fill-none stroke-accent [stroke-dasharray:4_3] [stroke-width:2]`) at the next free slot on the target point. This is the landing marker XG and Galaxy use, and it's readable on both point colours.
  - Check it in light and dark.
  - Also add `focus-visible:outline-none` to `interactiveTarget`. Its `stroke-focus` already replaces the ring, so the extra rectangular box from the global outline (the blue rectangle around point 6) goes away.

**M4. The list says "1 replies".**
- **Fix:** in `app/forum/page.tsx:42`, change `{post._count.replies} replies` to `{n} repl{n === 1 ? "y" : "ies"}`, the same pattern as "position(s)" on line 43.

## Should fix

**S1. Show the match context on the attached position, and demote the GNU IDs.**
- **Seen in:** `forum-write-post-6--1280-light--full`.
- **What's wrong:**
  - The post asks about "0-1 to 5", but nothing on the board or its caption shows the score or match length.
  - Meanwhile two mono IDs fill the caption strip, and at 390 they wrap onto two extra lines.
  - "From match decision 1149340" is an internal database ID.
- **Fix:** in `app/forum/[id]/page.tsx:55-67`, rebuild the meta strip as:
  - **First line:** `Position 1 · 5-point match · 0–1 · Crawford` (from `decodeGnuMatchId`'s `matchLength`, `score` and `crawford`; Crawford only when set), then `· 6-4 to play`, or `· Cube decision` for a cube position.
  - **Origin:** "Built in position builder", or for a match decision a link "From the game →" to the replay at that move. Send the investigator to confirm which data gives the replay URL from `sourceDecisionId`.
  - **GNU IDs:** put both inside a `<details>` labelled "GNU IDs", keeping the mono `identifier` style.

**S2. Faint text on sunken backgrounds fails contrast.**
- **What's wrong:** §8 forbids `text-ink-faint` on `sunken`. In the clubroom light theme it measures 4.3:1 (#736d61 on #efebe2), below 4.5. It's used in:
  - `forum.styles.ts:20`: `identifier`, inside the `bg-sunken` `position` panel;
  - `positionBuilder.styles.ts:44`: `statLabel`, inside the `bg-sunken` `stat`.
- **Fix:** use `text-ink-muted` in both places. In `statLabel`, also change `text-[11px]` to `text-xs`.

**S3. The Reply button stretches full width.**
- **Seen in:** `forum-write-post-6--1280-light--full`, a 860px black bar.
- **What's wrong:** it's the only full-width primary button on the page, and it outweighs the content. It stretches because `style.form` is a `flex-col` (`forum.styles.ts:8`).
- **Fix:** in `ReplyComposer.tsx:45-47`, wrap the button in `<div className={style.formActions}>`, and add `formActions: "flex justify-end"` to `forum.styles.ts`.

**S4. Use the shared input and error primitives.**
- **What's wrong:** `forum.styles.ts:9` builds its own input, without `focusRingInset`. `forum.styles.ts:16` colours form errors with the Error severity tier, but §1 reserves severity colours for severity.
- **Fix:** `input: shared.input` and `error: shared.errorBox` (the builder already does this, `positionBuilder.styles.ts:35,39`).
- **Labels:**
  - The edit form's title input and textarea (`ForumActions.tsx:62,64`) have no labels. Add `aria-label="Title"` and `aria-label="Body"`.
  - The textarea also needs `rows={6}`.
  - The reply textarea (`ReplyComposer.tsx:37`) has only a placeholder. Add `aria-label="Reply"`.

**S5. Delete has the same weight as Edit and uses `window.confirm`.**
- **Where:** `ForumActions.tsx:52-53,83`.
- **Fix:**
  - Open a `Modal` (§5) with "Delete this post?" or "Delete this reply?". Use `shared.modalHeading` and `modalButtons`, and make the confirm button `shared.buttonDanger`.
  - Render Delete as `<Button variant="quiet">` so it sits back from Edit.

**S6. The new-post form gives no preview of what's being attached.**
- **Seen in:** `forum-write-new-decision-1149340--1280-light--full`.
- **What's wrong:** a post prefilled from the replay shows only a "Decision ID 1149340" number field. You can't see the position before posting.
- **Fix:**
  - In `NewPostForm.tsx:130-139`, when the source is a match decision, show a read-only summary instead of the number field: a small static `Board` (or `BoardPanel` once S9 is settled) plus the S1 caption line.
  - Show the ID input only when you open "Change decision".
  - Reorder the actions at `NewPostForm.tsx:179-187`:
    - move "Add position" into the bottom of the attachment list as `variant="quiet"`;
    - end the form with `[Post] [Cancel]`, primary first, as elsewhere.
  - `attachmentTitle` (`forum.styles.ts:14`, `text-title`) is larger than the field labels and competes with the page title. Use `shared.overline` ("POSITION 1").

**S7. The explorer's status line is out of date after a move, and the move it built is barely visible.**
- **Seen in:** `forum-write-post-6-explorer-moved--1280-light--viewport`.
- **What's wrong:** after 6/2 it still says "Select a checker to begin.", and the played move "6/2" is a tiny faint line.
- **Fix:**
  - In `CheckerMoveExplorer.tsx:181-184`, when `state.hops.length > 0` and nothing is selected, say `Select a checker to play the ${remaining}.`
  - Move the notation into the status row, in place of the "Used: …" text. Show it as `6/2` in `font-mono text-ink` (`CheckerMoveExplorer.styles.ts:15`: `notation: "font-mono text-sm text-ink"`), followed by `· 6 to play`.
  - Drop "Used: none".

**S8. Out-of-date copy in the position builder.**
- **What's wrong:** the subtitle (`app/position-builder/page.tsx:17`, "before connecting it to save or analysis") and the footer (`PositionBuilder.tsx:371`, "Save and analysis are intentionally not connected yet.") contradict the "Post to forum" button directly below them.
- **Fix:**
  - Subtitle: "Set up a position and its match context, then post it to the forum."
  - Delete the footer note.
  - Make "Score" a fieldset legend above a two-column row labelled "Bottom" and "Top", so the "Score/Bottom" label doesn't stack into two lines (`PositionBuilder.tsx:270`).
  - `statValue` puts the word "Center" in mono, but mono is only for notation, equities and IDs. Use `font-mono` only for the numeric stats.

**S9. The forum list rows: only the title is a link.**
- **What's wrong:** the cards look clickable, but only the title text is a link, and it has no hover state.
- **Fix:**
  - In `app/forum/page.tsx:37-40`, give the title `Link` `shared.tableRowLink` (a link stretched over the card).
  - Change `forum.styles.ts:4` to `row: "relative flex flex-col gap-1 p-4 hover:border-line-strong"`. Since `Card` takes `className`, keep that hover class on the list's row only (a new `listRow` key), not on the post-body card.

## Later

- **L1. Show the analysis on a decision post.** Post 5 says "the analysis calls it an error", but the board has no Played/Best chips. Rendering the attachment through `BoardPanel` (the design system says it's "the only way to show a position", §5 The board) with the Played/Best chips would put the facts in the thread. That's a product decision, because invited members would see your equities. The explorer's direct use of `Board` should also either go through `BoardPanel` or be written into the design system as the approved exception.
- **L2. Put the discussion beside the board at 1280.** Today the post page is `width="medium"`, and the board alone fills the first screen. A `width="wide"`, `variant="detail"` layout with the board on the left and the post and replies on the right, the same split as the replay, would keep the position in view while you read. Below `lg` it stays as one column.
- **L3. Dates.** `toLocaleDateString()` (`app/forum/page.tsx:42`, `[id]/page.tsx:37,87`) depends on the server's locale. Use `lib/formatDate.ts` (`formatShortMatchDate`) for consistency with `/matches`.
- **L4. Small cleanups.**
  - `positionBuilder.styles.ts:22-31`: `sideOption` and `actionOption` are identical; merge them into one `segmentOption`. Replace `rounded-[7px]` with `rounded-control`.
  - The sign-in brand mark (accent and ink rings) doesn't match the navbar logo. Reuse the navbar mark.

No mockups. Each fix above is specific enough to spec without one.

## Open questions

- **Clerk theming:** whether the installed Clerk version accepts CSS variables in `appearance.variables` (M2). Check `node_modules/@clerk` before speccing.
- **Analysis on shared posts:** should invited members see the match analysis (played vs best, equity loss) on a decision post (L1)? That's your call.
- **Decision link:** linking a decision post back to the replay (S1) needs the match/game/move behind `sourceDecisionId`. Have the investigator confirm the lookup.
- **Not reviewed:** I didn't review dark mode beyond the explorer, and no screenshot shows the cube-position (plain board) attachment or the edit-in-place form.

## Re-check (fixes), 2026-10-13

Screenshots: `design/screenshots/2026-10-13-forum-fixes/`.

| Item | Verdict | Evidence |
|---|---|---|
| M1 board at 390 | Fixed | `forum-write-post-6--390-light--full` and `forum-write-position-builder--390-light--full` show the whole board, points 1–24, both trays, dice and cube. No inner scroll. |
| M2 sign-in | Fixed | `auth-sign-in--390-light--full`: one card that fits inside 390, serif title "Sign in to Game Review", ink primary button. |
| M3 highlights | Fixed | `forum-write-post-6-explorer-selected--1280-{light,dark}--viewport`: checkers are at full strength in both themes. The source bars along the base edge (24, 13, 8, 6) read on both point colours, and the dashed ghost on 2 is clear. |
| M4 "1 replies" | Fixed | `forum-write-list--1280-light--full`: "1 reply", "0 replies", "2 replies". |
| S2 faint on sunken | Fixed | `identifier` and `statLabel` are now `text-ink-muted`. `statLabel` is `text-xs`. |
| S3 Reply button | Fixed | Right-aligned, auto width, at 1280 and 390. |
| S4 shared input/error, labels | Fixed | `shared.input` and `shared.errorBox` in `forum.styles.ts:11,20`. `aria-label` on Title, Body and Reply. `rows={6}` on the edit body. (I didn't see a focus or error state in the screenshots. Checked in source only.) |
| S7 status line | Fixed | `forum-write-post-6-explorer-moved--1280-{light,dark}--viewport`: "Select a checker to play the 6." and "6/2 · 6 to play" in mono ink. |
| S8 builder copy | Fixed | New subtitle, no footer note, "Score" sits above "Bottom" and "Top" columns, and "Center" is no longer in mono. |

**Blocking the merge: nothing.** All three remaining points can go on the post-merge list:

- **Selected point: focus stroke drawn over the stack** (`…explorer-selected--1280-*`). Minor. It shows only on keyboard focus, and a visible keyboard focus is correct. Post-merge fix: while a point is `selected`, drop the triangle `focus-visible:stroke-focus` on its hit polygon. Show focus and selection together as a 2u `stroke-focus` ring around the top checker of the stack, drawn in the layer above the checkers next to the ghost marker.
- **Selected tint invisible under a tall stack.** Minor. A mouse user loses the "which checker is picked" cue, but the ghost landing marker still shows that a selection happened and where it goes. Post-merge fix: the same top-checker ring as above replaces the `fill-accent/30` tint, so a single treatment covers both mouse and keyboard.
- **Clerk "Secured by Clerk / Development mode" footer** (`auth-sign-in--390-light--full`). Polish. It's grey and unthemed, and the "Development mode" strip goes away with production keys. Post-merge fix: in `signIn.styles.ts` appearance `elements`, add `footer: "!bg-sunken"` and `footerItem`/`footerPages` `"!text-ink-muted"`, or hide the branding if the Clerk plan allows it.

## Re-check (post-merge Phase A), 2026-10-13

Screenshots: `design/screenshots/2026-10-13-forum-postmerge/`. I looked at post 5, post 6, the list, new-post (from decision 1149340, and empty) and the delete modal, at 1280 and 390 light, plus dark for post 5 and the new-post preview.

| Item | Verdict | Evidence |
|---|---|---|
| S1 caption | Fixed | `forum-write-post-5--1280-light--full`: "Position 1 · 5-point match · 1–0 · 2-1 to play", then "From the game →", then a collapsed "GNU IDs". `forum-write-post-6--1280-light--full` shows "Built in position builder". At 390 the caption fits on one line and nothing wraps. The dice order matches the caption (2 before 1, 6 before 4). Dark holds. |
| S5 delete | Fixed | Delete is now a quiet text button next to the bordered Edit, on the post and on each reply. `…delete-modal--{1280,390}-light--viewport` shows a centred modal with the serif heading "Delete this post?" and the buttons Cancel, then Delete. The confirm button is the ink primary, not the `shared.buttonDanger` that S5 asked for. That's acceptable: `buttonDanger` is the 28px table-row style (design system §5) and would sit badly next to a 38px Cancel, and the review-card delete modal (`app/review/cards/CardActions.tsx:57-81`) also uses a primary confirm. The two delete modals now match. |
| S6 new-post preview | Fixed (see new issue 1) | `forum-write-new-decision-1149340--1280-{light,dark}--full` shows the "POSITION 1" overline, the caption, a static board, "Change decision", a quiet "Add position" under the list, then Post and Cancel. `forum-write-new-empty--*` shows the builder and GNU-ID fields, with the actions in the same order. |
| S9 list rows | Fixed (hover checked in source) | `forum-write-list--*`: each row is a `listRow` whose title link uses `shared.tableRowLink`, which stretches the link over the whole card (`app/forum/forum.styles.ts:10-12`, `app/forum/page.tsx:39-41`). No screenshot shows the hover state or the focus ring. |
| L3 dates | Fixed | "13 Oct" and "12 Oct" on the list, the post and the replies, at both widths. |

### New issues, ranked

1. **Minor: the board in the new-post preview fills the full width at 1280.**
   - **Seen in:** `forum-write-new-decision-1149340--1280-light--full`. The board fills the 860px form, which pushes Post and Cancel to about y=1360, below a 900px viewport.
   - **Why it matters:** S6 asked for a small board. It only needs to confirm what you're attaching; you don't study the position here.
   - **Fix:** add `previewBoard: "w-full sm:max-w-md"` near `app/forum/forum.styles.ts:37`, and wrap the `<Board>` at `app/forum/new/NewPostForm.tsx:147` in `<div className={style.previewBoard}>`.
   - **390:** leave it as it is. The board stays full width there and is already smaller than on the post page (two insets deep), but it's still readable.
2. **Polish: at 390 the list's meta line breaks between a count and its noun.**
   - **Seen in:** `forum-write-list--390-light--full`. On four of the five rows the line ends "1 reply · 1" and "position" wraps to the next line.
   - **Fix:** in `app/forum/page.tsx:44-45`, join each count to its noun with a non-breaking space (` `).
3. **Polish (optional): the caption doesn't say whose score comes first.**
   - **What's there:** "1–0" puts the score of the player on roll first (`lib/forumPosition.ts:50-62`). That fits the decision-maker being drawn at the bottom, but an invited reader can't tell whose score is whose.
   - **Fix, only if readers ask:** give the score part a `title="Player on roll first"` with `shared.hintLabel`. That means rendering the caption as parts instead of one string.

### The two calls

- **"post-Crawford" in lowercase mid-caption: keep it.**
  - It's the standard term, written that way in GNU and XG.
  - Every other part of the caption is lowercase too ("5-point match", "2-1 to play"), so a capital "Post-" would look like the start of a heading.
  - It can never come first, because the match length always comes before it.
  - It matches `lib/review/format.ts:31-32`, so the review card and the forum use the same wording.
- **The delete modal's body text: good, with two small changes.** "Its replies go with it." is short, names the one consequence, and echoes the review-card modal's "Its review history goes with it."
  - **Post:** give the count ("Its 2 replies go with it.", "Its reply goes with it."), and drop the line when there are no replies. On a post with no replies, "Its replies go with it." reads oddly.
  - **Reply:** "The reply is removed from the thread." only repeats the heading. Use "This can't be undone." or drop the line.
  - **Where:** both are at `app/forum/[id]/ForumActions.tsx:118-122`. Pass the reply count in from `app/forum/[id]/page.tsx`, which already loads `post.replies`.

**Not in any screenshot (checked in source only):** the list's hover and focus states, the delete modal in dark, the reply-delete modal, and the input that "Change decision" opens.

## Re-check (post-merge Phase B), 2026-10-13

Screenshots: `design/screenshots/2026-10-13-forum-phase-b/`. I looked at the selected-explorer states for posts 5 and 6 (1280 and 390, both themes) and the tall-stack board crops, sign-in at 1280 and 390 in both themes, the position builder at 1280 light and 390 dark, the list at 390, and the new-post preview at 1280 in both themes. I checked the delete-modal text in source only (commit `6f98c71`).

| Item | Verdict | Evidence |
|---|---|---|
| Selected point: focus stroke over the stack | Fixed | `forum-write-post-6-explorer-selected-tall-stack--1280-{light,dark}--board`: the 6-point's triangle has no outline. The only selection mark is the ring round the top checker. `interactiveTarget(enabled, isSelected)` drops the stroke (`BoardPanel.styles.ts:74-80`). |
| Selected tint invisible under a tall stack | Fixed | The same crops: a 2u ring sits round the top of the five checkers on 6. It's clear on a dark checker in light mode (saturated blue) and in dark mode (light blue). At 390 (`…post-6-explorer-selected--390-dark--viewport`) it's thinner but still clear. The source bar and the ghost on 2 are unchanged. Post 5 dark shows the same ring with two ghosts. |
| Clerk footer | Fixed, within Clerk's limits | `auth-sign-in--390-light--full` and `…--1280-dark--full`: the footer strip is now `bg-sunken` in both themes, and the hard grey block is gone. "Secured by" is a quiet grey in both themes, which is fine. The orange "Development mode" and its dither only appear with dev keys. |
| Brand mark | Fixed | The sign-in badge shows the same two-checker mark as the navbar, in ink, and it inverts correctly in dark. The navbar at 1280 and 390 looks unchanged. |
| Segment radius | Matches, but see below | `forum-write-position-builder--1280-light--full`: the Side, Action and decision-mode controls all render. |
| New-post preview size | Fixed | `forum-write-new-decision-1149340--1280-{light,dark}--full`: the board is about 448px wide, and Post and Cancel moved up from about y=1360 to about y=1092. |
| List count wrap | Fixed | `forum-write-list--390-light--full`: the lines now break before "1 position" as a whole, and no row splits a count from its noun. |
| Delete modal text | Fixed (source only) | `ForumActions.tsx:128-136`. A reply now says "This can't be undone." A post with replies gives the count. A post with no replies has no body line. |

### The segment radius: use a smaller inner radius

Don't put a 9px option inside a 9px track. The track has `p-1`, so the option's corners sit 4px in from the track's corners. With the same radius, the gap at each corner is wider than the 4px gap along the edges, and the selected pill looks a little puffy against its track. At 1280 you can just see this on "Bottom" and "Add checker". It's polish, not a defect.

For the curves to nest, the option's radius should be the track's radius minus the padding: 9 − 4 = 5px.

There are now three segmented controls, each built slightly differently:
- the builder: a `p-1` track with a 9px option;
- the Settings mode switch: a `p-[3px]` track with a 7px option (`settings.styles.ts:62-68`);
- the TokenModal tabs: a `p-[3px]` track with a 7px option (`TokenModal.styles.ts:11-17`).

**Fix (S, one spec):**
- Add `--radius-inset: 0.375rem; /* 6px: an option inside a 3px-padded segmented track */` beside the other radii in `app/globals.css:127-129`.
- Give all three tracks `p-[3px]`, and give all three options `rounded-inset`.
- That replaces the two `rounded-[7px]` arbitraries and the builder's `rounded-control`, and gives one recipe for every segmented control.
- Add a row for it to the radius table in `docs/design-system.md`.
- My earlier L-item asked for `rounded-control`. That was the wrong target, and this supersedes it.

### New issues, ranked

1. **Polish: the preview board's drop shadow is heavy for its size.**
   - **Seen in:** `forum-write-new-decision-1149340--1280-light--full`. At 448px, the board's `drop-shadow-board` spreads far into the sunken inset to the right and below, so the small board looks like it's floating.
   - **Fix:** leave it. If you want it calmer, use a `previewBoard`-scoped override that removes the drop shadow on the static preview only. Don't change the shared `boardSvg`.
2. **Polish: "Its 1 reply goes with it." reads a little mechanically.**
   - **Fix:** use "Its reply goes with it." for one reply, as the Phase A note suggested, at `ForumActions.tsx:133`.
3. **Source-only, not seen:**
   - A selected stack taller than 5, where `stackSlotY` clamps and the top checker carries the "+N" count. The ring should go round the drawn top checker, label included, but no screenshot shows it.
   - A selected checker on the bar. No screenshot shows that either.

**Not in any screenshot:** the delete modal itself (with the new text), the reply-delete modal, and keyboard focus on a different point while one is selected. In that last case both marks are focus-blue, and only their shapes tell them apart: a triangle outline and a ring.
