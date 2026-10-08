# Design review: Clubroom Phase 1b (2026-10-08)

**Scope.** This review checks commit 4799722 against `design/mockups/{dashboard,review-card,replay}.html` and `reports/2026-10-08-design-fidelity-spec.md`.
- **Screenshots:** `design/screenshots/2026-10-08-phase1b/`, 114 PNGs. Below, file names drop the folder and the `.png`.
- **Not checked:** I didn't run the app. Hover, focus, the open Filter panel on /mistakes, the "+ tag" editor and the open Edit-note state aren't in the screenshots.

**Overall.** Phase 1b is a big step. The three mockup screens (replay, review and dashboard) now read as the mockups, and the board is faithful down to the unit. What's left is a short list of polish bugs and two mobile tables that overflow. None of it needs new design. It's one developer spec of small fixes (§d).

---

## (a) Fidelity per screen

| Screen | Verdict | Evidence and notes |
|---|---|---|
| **Replay** | **match** | `replay-checker-error-move2--1440-light--viewport` against `replay.html`: the crumbs, the italic "vs" title, the sub line, the segmented game switcher, the links, the stepper with kbd arrows, the Played/Best chips, the note card, and the move-list card with mini dice, "best …" lines and right-hand chips all match. Dark (`…--1440-dark--viewport`) and 390 (`…--390-light--viewport`, with the board inset 6px and the blocks at 16px) match too. Two bugs: the severity chip inside the chip label renders **uppercase** ("ERROR", "BEST"; the mockup's `.sev` is `text-transform:none`), and the move list doesn't bring the selected row into view (`replay-checker-with-cube-move15--1440-dark--viewport`: row 15 is below the fold). |
| **Review front** | **match** | `review-card1-front--1440-light--viewport` and `--390-light--viewport` match the mockup's front state: the session bar with "Card 1 of 3", the track and "3 new · 0 review", the summary and Filter pill, the context line, the serif question with the italic second half, the four options with kbd keys, and the hint. |
| **Review back** | **match** | `review-card1-back-correct--1440-light--full` and `review-card2-back-incorrect--1440-dark--full` match the mockup's two back states: the verdict, the summary `dl`, the options card with its caption, the inset bars and row labels, the cube equities inside the card, the note card with "Edit note"/"Write note", the grade row, the single "Next card · Recorded as Again · Enter" button, and the links after them. On 390 the sticky grade row works (`review-card2-back-incorrect--390-dark--viewport`). One flaw: in `review-card3-back-correct--390-light--full` the row label "BEST · YOUR ANSWER" breaks in the middle. |
| **Dashboard** | **close** | `dashboard--1440-light--full` against `dashboard.html`: the overline date, the 1.25/1/1 widget grid, the "3 cards" figure, the mini table with swatches, the stacked bar, the faint ".21", the match-id link, the 2fr/1fr lower row, the PR bars and chevrons, and the "Most repeated blunders" panel all match. Two gaps, both known: the due widget has no "3 new · 0 review" split (deviation 1), so it has an empty middle band about 100px tall, and the column says "Your error", not "Your PR" (held by the user). 390 (`dashboard--390-dark--full`) matches the mockup's narrow layout: one column, with Score and the chevron hidden. |
| **Matches** | **close** | `matches-list--1440-light--full`: the header with the baseline-aligned link, the shared table, "5 Oct", 2-decimal PRs, chevrons and whole-row links are right. The **Rating column mixes formats**: "2077.21", "2800", "2094.7". |
| **Analysis** (extra) | **match** | `matches-analysis--1440-light--full`: right-aligned numbers, "Checker"/"Cube", and "7 Oct 2026, 16:25". |
| **Match page** | **close** | `match-detail-47816592--1440-light--viewport` and `--1440-dark--full`: the header with the "Replay" switcher, the single stat card, the section head with the Game select, the replay layout, and the list rows with checkboxes all follow the spec. Gaps: the sub line has no date or score (deviation 2); the **checkboxes are the browser's default blue** in both themes (no `accent-color`); the chip labels are uppercase (as on the replay); and the unexplained "note" dot pushes some moves 12px right of the others. |
| **Mistakes** | **close** | `mistakes-checker-blunders--1440-light--viewport` and `--390-dark--viewport`: the summary and Filter pill, the lower-case result line with "Add all to review", the context line (BLZ, Blunder, "Loss **0.111**", Game 4, links), the board, the chips and the list card all match the spec. The flaw is vertical rhythm: 36px gaps between the filter row, the result line and the content (it comes from `PageShell.styles.ts` `column` → `md:gap-9`) make the top feel loose, against the mockup's tight 14px section-head spacing. |
| **Repeated positions** | **close** (1440) / **off** (390) | At 1440 (`repeated-positions-blunders--1440-light--full`) the code chip, severity chip, mono ID, serif "92×" and chevron all match. The header row's bottom border stops before the chevron column (a missing empty `<th>`). **At 390** (`repeated-positions-blunders--390-dark--full`) the table overflows, and **Times faced and the chevron are off-screen**, so the one number the page exists for is missing. The drilldown (`repeated-positions-blunders-drilldown--1440-dark--viewport`) stacks four loose rows (filter, "← back to repeated positions", "92 occurrences of this position (…)", the context line), each 36px apart. The unfiltered state (`repeated-positions-unfiltered--1440-light--viewport`) is fine. Its Apply button (38px) sits 2px off the 36px selects. |
| **Review cards** | **close** (1440) / **off** (390) | At 1440 (`review-cards--1440-light--full`) the crumb, filter pattern and table follow the spec, but there's a stray period in "3 cards." and the same loose 36px rhythm. **At 390** (`review-cards--390-light--full`) the table is cut off after Tags: Due, Reps, Lapses, State and **the Suspend/Delete actions are unreachable**, and the Position cell wraps one word per line. |
| **Status** | **match** | `status--1440-dark--full`: the separators, mono versions and the migration name, and the row pattern. |
| **Mobile menu** | **match** | `nav-menu-open--390-light--viewport` (and dark): 44px rows, a 2px ink bar on the active row, Cards indented, the hairline, the sync row, and Status with "?" on one row. |
| **`?` help** | **off** (1440) / **match** (390) | `shortcuts-help-open-replay--1440-dark--viewport`: **the first description is clipped** at the panel's right edge ("…the previous game's las"). The panel is overflowing horizontally rather than wrapping. 390 (`…--390-light--viewport`) wraps correctly. The scrim and blur behave in both themes. |

**Navbar (all screens): match.** It's sticky and translucent, with the brand mark, the mode badge first in the end group, "Synced 3 days ago · 28 matches", the underlined token link, Status and the 30px "?". The content edge is 124px at 1440, so 1240 − 2×24 is honoured.

---

## (b) The board

I measured `replay-checker-error-move2--1440-light--viewport` (788px for 562u, a scale of 1.402) against `replay.html`'s `board()`.

| Item | Verdict |
|---|---|
| Geometry | **Faithful.** 562×380, 14u frame and 20u bands, 36u points with 17u half-widths and 148u triangles, a 30u bar, 34u trays with an 8u gap at y=190. Odd points are dark: 13 is dark and 14 is light, as in the mockup. |
| Checkers and stacking | **Faithful.** r=15, a 9.5u ring, 32u pitch with a 2u gap, the base at 343/37. The "+N" cap draws five ringed checkers with "+1" on the fifth (`review-card1-front--1440-light--viewport`, point 6), so it now means "N more than shown". |
| Point numbers | **Faithful.** 10u (about 14px) from `sm`, and 15u below it (about 10px at 390, `replay-checker-error-move2--390-light--viewport`), so they're legible. |
| Dice | **Faithful.** Native 26u SVG dice in the mover's checker colour with 0.09s pips, centred at x=398 and y=190, 8u apart. |
| Cube | **Faithful.** 26u at x=16. It's centred at y=177 (`replay-checker-error-move2`), at the top when the opponent owns it (y=24, `replay-checker-with-cube-move15`), and on the bar at the receiver's edge when offered (`replay-cube-take-move16--1440-light--viewport`, the "4" at 275,345). |
| Arrows | **Faithful.** A bone halo at .75, a 3.5u shaft, a 13u × 15u head, a 4u origin dot, and severity colours including the new Good tier. The hit marker is the dashed ring (`review-card1-back-correct--1440-light--full`, point 1). Best-move arrows on the review back match the mockup. |
| Off trays | Kept behaviour, restyled to fit the 34u tray. It's consistent with the frame. |
| Dark board | The tokens match the mockup. The rim follows deviation 11. |

The board is done. The only thing I'd change later is a Phase 2 note, not a Clubroom gap: the error arrow `#A86F00` on the dark bone `#C9BC9F` is the weakest of the four arrows (`replay-checker-with-cube-move15--1440-dark--viewport`). It's still clearly readable at 3.5u with the halo.

---

## (c) Deviations 1–11

| # | Deviation | Verdict | Reason |
|---|---|---|---|
| 1 | No "3 new · 0 review" split | **Accept for now, and ask for approval.** | It reuses the `/review` page's existing `dueNew`/`dueReview` counts, so it's cheap. Without it the due widget has an empty band. It's in the needs-approval list. |
| 2 | Match sub line without date and score | **Accept for now, and ask for approval.** | It's correct not to add a query unasked. It's in the needs-approval list. |
| 3 | No Played/Best chips on the review back | **Accept.** | The mockup's summary `dl` already says "Played in game" and "Best". Chips would repeat it, and the back face would get taller on mobile. My spec line was the error. |
| 4 | The legend adds Good | **Accept.** | Good rows are coloured (slate) and carry a "Good" chip, so the legend has to explain them. |
| 5 | Previous/Next game links removed | **Accept.** | The switcher, plus ←/→ crossing games (and documented in `?`), covers it. |
| 6 | Filter starts open when no filter is set | **Accept.** | Otherwise the page is an empty sentence behind a closed control (`repeated-positions-unfiltered--1440-light--viewport`). |
| 7 | "Opponent doubles. *Take or pass?*" | **Accept.** | It follows the pattern "statement. *question*", and it's clearer than "Cube action. *What do you do?*" for the receiver. |
| 8 | "Best is X. Yours loses only 0.0xx." | **Accept.** | It's honest about a correct-but-not-best answer. Keep the plain number with no minus inside a sentence, as now. |
| 9 | The date overline is the server's local day | **Fix (S).** | Deployed on Vercel, the server runs in UTC, and the user is at UTC+11. Every morning before 11:00 the dashboard would show yesterday's date. Render the overline in a small client component with `new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date())`, with `suppressHydrationWarning` on the `<p>`. That gives "Thursday 8 October" in the browser's zone. The same server-zone issue affects the "5 Oct" match dates near midnight. That one is low impact, so it's noted, not fixed here. |
| 10 | "In review ✓" without the due time on screen | **Accept.** | The note card stays calm. Optionally add `title="Due {relative}"` so it still shows on hover. |
| 11 | Dark mine rim #7A7266 | **Accept.** | At 3.4:1 against the fill and the dark frame it's better than the mockup's #5E584F. Bar checkers and the dark points stay outlined. |

---

## (d) Gaps to close before the user's check

These are in priority order. Each is S unless marked, and together they make one developer spec. Every class goes in the named `.styles.ts`.

1. **Severity chips render uppercase inside the Played/Best labels.** This affects the replay, match page, mistakes and drilldown. In `lib/styles/shared.styles.ts`, `severityChipShape`, add `normal-case`, which gives `"inline-flex items-center rounded-[4px] px-1.5 py-[3px] font-sans text-[10.5px] font-semibold normal-case leading-none tracking-[0.02em]"`. *(The spec left `text-transform:none` out. My miss.)*
2. **The `?` help is clipped at 1440.** In `AppNav.styles.ts`, change `helpRow` to `"grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-x-3 py-0.5 text-sm text-ink-muted"` and drop `w-28 shrink-0` from `helpKeys` (it becomes `"flex flex-wrap gap-1"`). Add `overflow-x-hidden` to `shared.modalPanel`. The developer should confirm with a new `shortcuts-help-open-replay--1440-*` shot that the first line wraps.
3. **/repeated-positions at 390: Times faced is off-screen.** In `repeatedPositions.styles.ts`, give the Severity `th`/`td` `max-md:hidden`. Make the Position ID cell `font-mono text-[12px] text-ink-muted` below md (that's 12.5px from md). Add the missing empty chevron `<th>` (with `tableHeadCell` and `w-7`) so the header border runs the full width.
4. **/review/cards at 390: the actions are unreachable.** In `reviewCards.styles.ts`, give Type, Phase, Tags, Reps, Lapses and State `max-md:hidden` (on th and td). Keep Position, Due and Actions. The actions cell becomes `flex flex-col items-end gap-1.5 md:flex-row md:items-center` below md. In the Position cell, keep the mono line `whitespace-nowrap` and let the match link wrap as one unit (`inline-block`).
5. **Checkbox colour** (match page, replay "Fixed perspective", the filters). In `app/globals.css` `@layer base`, add `input[type="checkbox"], input[type="radio"] { accent-color: var(--color-ink); }`. That's near-black in light and cream in dark, matching the primary button. No per-component class needed.
6. **The selected move row out of view** (replay, match page, mistakes). When the selection changes, and on mount, scroll only the list's own scroller, not the page. Use `list.scrollTo({ top: row.offsetTop - list.clientHeight / 3, behavior: "instant" })`, clamped at 0, so the selected row sits in the top third even when the card's lower part is below the fold. Use `instant` when the user has `prefers-reduced-motion` set, and `smooth` otherwise.
7. **Vertical rhythm on the list pages** (/mistakes, /repeated-positions and its drilldown, /review/cards). The 36px `column` gap is for dashboard sections, not for the controls under a title.
   - Render the `FilterDisclosure` inside the page header block with `mt-4`.
   - Wrap the result line and its content in one `flex flex-col gap-3.5` group. The 36px gap then only separates the header from that group.
   - The result line row is `flex items-center justify-between gap-4 text-[13.5px] text-ink-muted`.
   - **Drilldown:** "← back to repeated positions" becomes breadcrumbs: "Repeated positions › 4HPwATDgc/ABMA", in the shared `Breadcrumbs`, above the h1. The summary becomes the result line: "92 occurrences · Opening game · Blunder · ply 1".
   - **Cards:** "3 cards." becomes "3 cards". "← Review now" moves to the title row's right side as a `textLink` "Start review →".
8. **The "has note" dot shifts the move text.** In `DecisionList.styles.ts`, take `noteDot` out of `moveCell` and put it first in `trailingCell`. Keep `h-1.5 w-1.5 rounded-full bg-accent`. Give it `title="Has a note"` and an `sr-only` "has a note" span. Moves then align left in every row.
9. **Rating column format** (/matches). Use the dashboard's formatting: `toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })`, giving "2,077.21", "2,800.00" and "2,094.70", in `tableCellNumeric`.
10. **Review option label wraps on 390.** In `review.styles.ts`, add `whitespace-nowrap` to the option row label (`ml-2.5 font-sans text-[10px] …`). The whole label then drops to the next line instead of breaking "BEST · YOUR / ANSWER".
11. **Filter control heights.** In `shared.styles.ts`, change `filterSelect` from `h-9` to `h-[38px]` so the selects line up with the 38px Apply button.
12. **Date overline** (deviation 9 above): make it a client-rendered date.

### Needs approval: new data or queries

- **A. The dashboard due split, "3 new · 0 review"** (deviation 1). It reuses the `/review` page's `dueNew`/`dueReview` counts on the dashboard: one more existing query, with no schema change. I recommend it, because it fills the widget's empty band.
- **B. The match-page sub line "Match 47816592 · 5 Oct 2026 · 2–5"** (deviation 2). It needs the match's date and final score on that page.
- **C. "Your PR" relabel** (still held). It's a user decision once the investigator has confirmed the value is PR. Until then, "Your error" stays.

---

## (e) Ready for Phase 2?

**Yes, once §d items 1–8 land.** Items 1, 2, 5 and 11 are shared tokens and primitives, so Quiet Ink and Midnight Felt would inherit any defect left in them. Items 3, 4, 6 and 7 are layout and don't depend on the theme, so they could run in parallel with Phase 2 if the user prefers. The board, navbar, review session and replay are complete and faithful, which makes them a good base for themes.

**Before the themes start, the Phase 2 spec should check:**
- each theme's four arrow colours at ≥ 3:1 on its own bone, in light and dark (the weakest Clubroom case is the dark error arrow);
- the `accent-color` from item 5 against each theme's ink;
- the `--primary` contrast of the grade row's primary "Good" button in dark.
