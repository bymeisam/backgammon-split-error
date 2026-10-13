# Forum decision analysis panel: design review (Phase 2b, 94cdb68)

Screenshots: `design/screenshots/2026-10-13-forum-analysis/` (1280 and 390, light and dark). The navbar band in full-page shots is ignored as a capture artefact.

## Verdict

The panel is ready to ship. Nothing is a blocker. It reuses the review card's language (Best tint plus a 3px Best bar, the same cube-cell recipe, mono equities, the shared `Table` and `Button`), it works in both modes, and it fits at 390. Nothing visible hints at the played move. The fixes below are about hierarchy and how the numbers read, not about whether it works.

## Played-move leak check: holds

- **Checker table:** no row is marked other than rank 1 (Best). It has no severity chips, no arrows and no "Yours" tag. Ranks are renumbered 1..n (`DecisionAnalysisPanel.tsx:50`).
- **Cube panel:** it shows only Best, the detail, and ND/DT/DP.
- **Small blue bars at 6, 8, 13 and 24** (`forum-write-post-5--*`): these are the explorer's movable-checker markers (`BoardPanel.styles.ts:81`). With 2-1 they sit on every stack the player can move, so they don't single out the played move. They also appear in the edit shot before analysis opens. That's fine.
- **Open data question (not visual):** `lib/forumAnalysis.ts:67` passes through every source candidate. If the source appends the played move when it falls outside its top-N, it would show up as the last row with an unusually large loss, which gives the answer away. The investigator should check whether Galaxy candidate lists are always a contiguous top-N.

## Findings

### Should

1. **The toggle reads as a third explorer control.** In `forum-write-post-5--1280-light` and `--390-light`, "Show analysis" sits on its own line under "Undo last hop / Reset position", in the same button style and with no separation. It looks like part of the board explorer, not like the start of a separate answer section. Width and theme: all. Fix: give `style.analysis` (`forum.styles.ts:56`) a hairline top and a little air, e.g. `"mt-1 flex flex-col gap-3 border-t border-line px-2 pt-3 sm:px-0"`. Optionally add a `shared.overline` "Engine analysis" label to the left of the button in a `flex items-center justify-between` row. The cube post (no explorer) is unaffected either way.

2. **At 1280 the checker table is spread too wide.** In `forum-write-post-5-analysis--1280-*`, the move sits at x≈116, equity at ≈636 and loss at ≈912. The eye crosses about 500px of empty row to pair a move with its equity. Wide only. Fix: fix the widths of the two numeric columns so the move column takes the slack and the numbers sit together on the right. Add an `analysisNumberCol: "w-24"` (header and cells) in `forum.styles.ts:64`. Alternatively, cap the panel with `sm:max-w-xl`, which puts the table at the review card's options width.

3. **At 1280 the cube equities are equally sparse.** In `forum-write-post-7-analysis--1280-light`, three roughly 290px cells hold left-aligned 15px values. Fix: `analysisEquities` (`forum.styles.ts:66`) gets `sm:max-w-md` (the same cap as `previewBoard`), so the strip reads as one compact object, as on the review card.

4. **Contrast of `ink-faint` on `best-tint`.** The best cube cell's label "Double / Take" is `text-ink-faint` (`forum.styles.ts:73`) on `bg-best-tint` (`:71`). Design system §8 guarantees 4.5:1 for `ink-faint` only on `paper` and `surface`. The review card never tints this cell, so this pairing is new and unchecked. In `forum-write-post-7-analysis--1280-light` it looks noticeably lighter than the other two labels. Fix: make the label a function of `isBest` that uses `text-ink-muted` on the best cell, or measure both modes and record the result.

5. **The checkbox wording is wrong for the edit form.** "Permanently hide analysis" can be unchecked again in edit (`ForumActions.tsx:46,116`), so "Permanently" overstates it, and nothing explains what's hidden or from whom. Seen in `forum-write-post-5-edit--*` and `forum-write-new-decision-1149340--*`. Fix: change the label to "Hide engine analysis", with a one-line hint underneath in `text-xs text-ink-muted`, e.g. "Readers won't be able to open the analysis for this post's game positions." That needs a `checkboxHint` entry and a `flex-col` wrapper. On the new-post form, the checkbox's position after "Add position" and before Post/Cancel is right, because it's a post-level setting. Keep it there.

### Could

6. **Signs and minus glyphs (source-only, cross-cutting).** `formatEquity` (`lib/review/format.ts:58`) uses `toFixed`. That gives an ASCII hyphen and no "+", while `formatLoss` uses U+2212. One row can therefore mix two minus glyphs, and positive cube equities show as `0.371`, not `+0.371`. The repo convention is a signed value with a true minus. The difference can't be resolved at this screenshot scale. The review card shares the formatter, so make this its own small spec, not part of this panel.
7. **Best is shown by colour alone.** The rank-1 row has only the tint and bar. Rank "1" and loss `0.000` carry the meaning too, so this is acceptable, but a small "Best" `optionTag` (the review card's `review.styles.ts:79` pattern) after the move would match §4's "never colour alone".
8. **Card inside a card.** The table wrapper (surface, border, radius) sits inside the sunken position panel (`forum.styles.ts:28`). The review card's options card does the same, so it's consistent, but §5 discourages it. Polish only. Leave it unless the panel is restyled.
9. **Long moves at 390 (source-only).** The sample moves are short and fit (`forum-write-post-5-analysis--390-*`). Something like `bar/22 13/11 6/5(2)` will wrap inside the move cell. `whitespace-nowrap` on `analysisMove` would rely on the table wrapper's horizontal scroll, which needs a screenshot to judge. Recheck when a post with a long move exists.
10. **Toggle state after a tap at 390 light.** "Hide analysis" shows the sunken (hover) fill and looks a lot like the disabled "Undo last hop" next to it. This is most likely Playwright's leftover hover, not a defect. Ignore it unless it shows up on a real device.
11. **Checkbox touch target.** The label row is about 24px tall at 390. Adding `py-1` to `checkboxLabel` (`forum.styles.ts:51`) brings it near 32px without changing the look.

### Must

None.

## Checked and held

- **Tokens only:** no hex, no `dark:` and no raw palette classes. The arbitrary `text-[11.5px]` and `text-[15px]` mirror `review.styles.ts:91-92`.
- **Mono** only on moves and equities. Numeric columns are right-aligned with tabular figures through `kind="numeric"`.
- **Dark mode:** the Best tint and bar read clearly on both the checker row and the DT cell. Hairlines and header contrast match the light version.
- **390:** the four columns fit without horizontal scroll. The cube strip's three cells fit, and labels like "Double / Pass" don't wrap. The panel keeps the caption's inset (`px-2`).
- **Cube best cell:** DT is highlighted when ND 0.371 < DT 0.422 < DP 1.000, which is correct (best = max(ND, min(DT, DP))). The "Best: Double · opponent should take" line follows the app's cube wording.
- **Accessibility:** the toggle has `aria-expanded` and `aria-controls`, and the shared button's focus ring applies.
- **The board itself is unchanged:** numbering from the bottom player, the decision-maker at the bottom, the cube at the bar, and the higher die first (2-1).
