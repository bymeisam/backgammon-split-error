# Design review: Clubroom Phase 1c check (2026-10-08)

**What this checks.** Commit 465bc8a, against the gap list in `reports/2026-10-08-design-review-phase1b.md` §d.

**Screenshots.** `design/screenshots/2026-10-08-phase1c/`. File names below drop the folder and the `.png`.

**Not checked.** I didn't run the app, so hover and focus states aren't covered.

## (a) Gaps from the Phase 1b review

| # | Gap | Status | Evidence |
|---|---|---|---|
| 1 | Severity chips in capitals | **closed** | `replay-checker-with-cube-move15--1440-dark--viewport` shows "Error", "Best" and "Good". `mistakes-checker-blunders--1440-light--viewport` shows "Blunder". |
| 2 | `?` help clipped at 1440 | **closed** | In `shortcuts-help-open-replay--1440-dark--viewport`, "…the previous / game's last step)" wraps inside the panel. |
| 3 | /repeated-positions at 390 | **closed** | In `repeated-positions-blunders--390-dark--full`, Severity is hidden, "92×" and the chevron are on screen, and the header border runs the full width. |
| 4 | /review/cards at 390 | **mostly closed** | In `review-cards--390-light--full`, Position, Due and Actions all fit. But Suspend and Delete run about 6px past the card's edge. See (c)1. |
| 5 | Checkbox colour | **closed** | `match-detail-47816592--1440-light--viewport` has ink-coloured checkboxes. |
| 6 | Selected row scrolled out of view | **closed** | In `replay-checker-with-cube-move15--1440-dark--viewport`, row 15 sits in the top third of the list. |
| 7 | Spacing on the list pages | **closed** | `mistakes-checker-blunders--1440-light--viewport`: the Filter is now in the header, and the result line sits tight on its content. `repeated-positions-blunders-drilldown--1440-dark--viewport`: breadcrumbs, and the line "92 occurrences · Opening game · Blunder · ply 1". `review-cards--390-light--full`: "3 cards", with "Start review →" on the title row. |
| 8 | Note dot shifting the move text | **closed** | In `match-detail-47816592--1440-light--viewport`, the dot sits before the loss and the moves line up. |
| 9 | Rating format on /matches | **closed** | `matches-list--1440-light--full` shows "2,077.21", "2,800.00" and "2,094.70". |
| 10 | Review option label wrapping at 390 | **moved, not fixed** | In `review-card3-back-correct--390-light--viewport` the label no longer breaks. Instead the move breaks: "No Double /" ends one line and "Take" starts the next. The fix is below the table. |
| 11 | Filter control heights | **closed** | In `repeated-positions-unfiltered--1440-light--viewport`, the selects and Apply are the same height and line up. |
| 12 | Date overline | **closed** | `app/TodayOverline.tsx` renders it on the client. `dashboard--1440-light--full` shows "THURSDAY 8 OCTOBER". |
| A | Due split on the dashboard | **closed** | `dashboard--1440-light--full` shows "3 new  0 review", and the empty band is gone. The total doesn't always match the split, though. See (c)2. |
| B | Match sub line | **closed** | `match-detail-47816592--1440-light--viewport` shows "Match 47816592 · 5 Oct 2026 · 2–5 · You: meisam2". |
| C | PR labels | **closed** | `matches-list--1440-light--full` shows "YOUR PR" and "OPP. PR" with the dotted hint. `dashboard--1440-light--full` uses them too. |

**Fix for #10** (size S, `app/review/review.styles.ts:77`). Below md, put the tag on its own line. Then neither the move nor the label breaks.

```ts
optionTag: "whitespace-nowrap font-sans text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-faint max-md:mt-1 max-md:block md:ml-2.5",
```

## (b) New regressions

This commit didn't add any regressions. Two older issues remain.

**The sticky grade row has no background.** I missed this in the Phase 1b review, where I said the sticky row works. In `review-card3-back-correct--390-light--viewport` and `review-card2-back-incorrect--390-dark--viewport`, the options table shows through the 8px gaps between Hard, Good and Easy (the stray "e" and "a"). It's the cleanest view of the session, so it needs a solid band behind it.

Fix (size S, `app/review/review.styles.ts:93`):

```ts
grade: "z-10 grid grid-cols-3 gap-2 max-md:sticky max-md:bottom-0 max-md:-mx-4 max-md:border-t max-md:border-line max-md:bg-paper/95 max-md:px-4 max-md:py-3 max-md:backdrop-blur",
```

**The dashboard subtitle names Galaxy.** It says "PR and mistake breakdowns for your Backgammon Galaxy matches." (`app/page.tsx:287`, visible in `dashboard--1440-light--full`). That breaks the rule that general UI never names Galaxy. Change it to **"PR and mistake breakdowns for your matches."** The "Galaxy" nav item and the "View on Galaxy ↗" links are actions specific to that source, so they can stay.

## (c) The three leftovers

### 1. Suspend and Delete overflow on /review/cards at 390: fix it (size S)

The mono summary line can't wrap, and that sets the column's width. File: `app/review/cards/reviewCards.styles.ts`.

1. Let the line wrap below md: `positionText: "font-mono text-[12.5px] text-ink-muted md:whitespace-nowrap"`.
2. Wrap each part of the line in a span, so it only breaks at the "·" separators. "6-5" is one part and "played 22/11" is another. Add a key `positionSegment: "whitespace-nowrap"`.

"Doubler · played No Double" then breaks after the dot, and the actions column fits. Don't shrink the buttons. They're about 36px tall, which is the minimum comfortable touch height.

### 2. The dashboard's due number: show the split's sum

File: `app/page.tsx:63-75` (size S).

**Change the number.** Compute `const shown = split.new + split.review` and use it in three places: the big figure, the "card" / "cards" plural, and the choice between "Start review" and "Open review". The big number then always equals what a session will actually serve, and it matches the review header's "N new · N review".

**Match the nav badge.** The nav badge (`app/components/ui/AppNav.tsx:20`) should show the same sum. Then the nav and the dashboard can never disagree.

**Show what's held back.** When the unlimited count is bigger, add one faint line under the split. It shows only when `due − shown > 0`:

- Copy: "{due − shown} more held back by today's limits".
- Style: `text-xs text-ink-faint`, as a new `home.styles.ts` key `dueHeld`.

The backlog stays visible, and today's number doesn't get inflated.

### 3. Ratings on /galaxy/matches: use the /matches format (size S)

Locations: `app/galaxy/matches/page.tsx:204` (the header cell) and `:229` (the body cell).

**Format.** Use `m.opponentRating.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.

**Alignment.** Use `shared.tableHeadCellNumeric` / `shared.tableCellNumeric` for the Rating header and cells, through keys in `galaxyMatches.styles.ts`. That gives right-aligned tabular figures.

**PR cells.** In the same pass, move the two PR cells from `monoCell` to the same numeric cell. /matches uses sans tabular figures for PR, and this table should look the same.

"Your PR" / "Opponent PR" can stay as they are on this page, because it's specific to Galaxy.

## (d) Verdict

**Clubroom is done. Go ahead with Phase 2 (Quiet Ink and Midnight Felt).**

Every gap from the Phase 1b review is closed except six size-S items:

- #10, the option tag;
- the background on the sticky grade row;
- the subtitle copy;
- (c)1 to (c)3.

None of them touches a theme token. They're local classes, copy and one display sum, so they fit in one small spec. That spec can run alongside the first step of Phase 2 without holding it up.

**Phase 2 pre-checks.** The checks from the Phase 1b review (§e) still apply:

- each theme's arrow colours against its own bone;
- `accent-color` against each theme's ink;
- the primary "Good" button in dark.

Add one more: the sticky grade row's `bg-paper/95` in each theme.
