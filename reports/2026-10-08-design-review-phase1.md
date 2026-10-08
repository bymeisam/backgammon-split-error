# Design review: Clubroom Phase 1 implementation (2026-10-08)

This reviews commit `e3443e8` against `reports/2026-10-08-design-review.md` and the mockups in `design/mockups/`.

I compared new screenshots (`design/screenshots/2026-10-08-phase1/`) with the old ones (`design/screenshots/2026-10-08/`). I read about 25 pairs and covered every page at both widths and in both themes. I also read `app/globals.css`, `app/themes/clubroom.css`, `lib/themes.ts`, `app/layout.tsx`, `lib/styles/shared.styles.ts`, `lib/badges.ts`, `lib/checkerPalette.ts`, `Board.tsx`, `BoardPanel.tsx/.styles.ts`, `DecisionList.styles.ts` and `Dice.tsx`. Then I grepped every `.ts`/`.tsx` under `app/` and `lib/` for hex values, `rgb()`, raw palette classes and `dark:` variants.

In citations, screenshot names drop the folder. `old:` marks the old folder.

> **Update.** The user has asked for full fidelity to the mockups. The exact per-screen and board values are in `reports/2026-10-08-design-fidelity-spec.md`. The "close" scores below are measured against the Phase 1 scope; against the mockups they are **off** for layout (dashboard grid, review session, replay and the board pages), and the board geometry differs. The fix list in (d) still applies and is folded into the spec (§7).

---

## (a) Verdict

**Phase 1 matches the Clubroom direction.** The app no longer looks like default Tailwind:
- titles are set in the Newsreader serif;
- the UI text is Geist, now that the Arial leftover is gone;
- mono is used only for notation and equities;
- the paper and charcoal surfaces are warm;
- severity colours come from one source.

The board is the biggest improvement. It's a real object now, with a walnut frame, bone surface, readable numbers and a dimmed board in dark mode. The token layer is unusually clean: there are **no hex values and no zinc or black classes left in any `.styles.ts` file**, and only one `dark:` string remains, in a comment.

What's left is mostly the larger layout items from the original plan (#10 to #14). Those were never Phase 1 scope.

| Screen | Score | Evidence |
|---|---|---|
| Dashboard | **match** (1440), **close** (390) | `dashboard--1440-light--full`: serif title and figures, "Review now" primary button, overline labels, hairline table. At 390 the table now clips its last column (see b1). |
| Matches list | **close** | `matches-list--1440-light--full`: sans dates and ratings with tabular numbers, quiet "Replay" links, underline nav state. Numeric columns are still left-aligned (`shared.tableCellNumeric` exists but isn't used here). |
| Match page | **close** | `match-detail-47816592--1440-light--viewport`: serif PR figures and an unclipped loss column. The board still runs below the fold at 1440, which is layout item #13/#14 and wasn't in Phase 1. |
| Replay | **close** | `replay-checker-error-move2--1440-light--viewport` / `--1440-dark--viewport`: the board matches `replay.html`, and so do the Played/Best chips with a tint and side bar. The step bar, game switcher and "best …" lines are still missing (#13). |
| Mistakes | **close** | `mistakes-checker-blunders--1440-light--viewport` vs `old:` the same file: one red for Blunder, the filter bar has no box, the board is no longer card-in-card, and the loss column is visible. The copy (`|error| 0.111`, `checker`) isn't polished yet (deviation 6). |
| Review, front | **close** | `review-card1-front--1440-light--viewport`: option rows with keycaps, serif question, framed board. The filter form and counts still sit above it (#12). |
| Review, back | **close** | `review-card1-back-correct--1440-light--full`, `review-card2-back-incorrect--1440-dark--full`: the verdict is a serif italic word instead of a slab, the rating buttons are neutral and show their keys, and the option rows have tints and side bars. It's still four stacked cards, and the ratings are below the fold (#12). |
| Review cards | **close** | `review-cards--1440-light--full`: consistent small buttons, and Delete is in blunder ink. |
| Status | **match** | `status--1440-dark--full`. |
| Navbar (bonus) | **close** | It already has the serif wordmark, the underline active state, the dot-and-text mode and the accent due badge. It isn't sticky (deviation 3). The mobile sheet still has Status and `?` on separate, uneven rows (`nav-menu-open--390-light--viewport`). |
| Mobile overall | **close** | Point numbers are readable at 390 (`mistakes-checker-blunders--390-light--viewport`; before, `old:` showed about 3.5px numbers). The board is no longer double-carded. The review back face is about 1,550 CSS px tall, down from about 2,000 (`review-card1-back-correct--390-dark--full`). |

---

## (b) Problems and regressions

1. **Mobile dashboard: "Your error" is clipped (regression).** `dashboard--390-dark--full` shows "YO / ER" and "5.2" cut off at the card edge. In the old screenshot (`old:dashboard--390-dark--full`) all four columns fit, because the mono dates wrapped onto two lines. The new `whitespace-nowrap` on `shared.tableCellMuted` (`lib/styles/shared.styles.ts`, used at `app/home.styles.ts:36`) together with `px-4` makes the table wider than 390, and the clipped column is the one that matters most. The quick fix: below `sm`, use `px-3` cells and drop the year from dates ("5 Oct"), which was already in the report's §3.2 rule.
2. **Dark-mode modal scrim is a light wash (bug).** `modalOverlay` uses `bg-ink/40` (`lib/styles/shared.styles.ts:105`). In dark mode `ink` is cream `#EDE8DD`, so the page behind the `?` help turns beige-grey instead of dimming (`shortcuts-help-open-replay--1440-dark--viewport`). It needs a theme token: `--scrim`, set to `rgb(29 27 23 / .4)` in light and `rgb(0 0 0 / .6)` in dark.
3. **The played-move chip contradicts the move list (pre-existing, now more visible).** In `replay-cube-take-move16--390-dark--viewport`, the played "Take (0.000)" is amber, as an Error, while the list shows that row's "Take" in green as Best. The cause is `playedMoveTier(null)`, which returns `"error"` (`lib/badges.ts:47`). The old build did the same (`old:replay-cube-take-move16--390-dark--viewport`), but Phase 1 made the chips read clearly as severity. An ungraded played move with a loss of 0.000 should be `"best"`. Someone should confirm with the investigator that `severity === null` means "Best" before changing it.
4. **The arrow for a "Good" move is amber.** `ArrowTier` has no `"good"`, and the arrow tier is computed at `BoardPanel.tsx:73`. So a played Good move gets a slate chip (deviation 5) but an amber arrow. The fix: add `--arrow-good`, Good's slate darkened for bone. `#4E5D72` should give about 4:1 on light bone, but someone should check it on the dimmed dark bone.
5. **A "mine" checker on the bar almost disappears in dark mode.** `--checker-mine` `#1E2126` sits on `--board-frame` `#2A1F17`, so only the `#5E584F` rim shows it (the bar checker in `review-card2-back-incorrect--1440-dark--full`, bottom centre). The fix is minor: give the dark-mode checker rim a lighter value such as `#7A7266`, or lift the bar fill slightly.
6. **Small inconsistencies that can wait:**
   - The severity chip is mono inside the decision list but sans in the card header (`mistakes-checker-blunders--1440-light--viewport`).
   - The "Mistake pattern analysis →" link sits below the title's baseline (`matches-list--1440-light--full`).
   - The status counts have no thousands separators.

**Nothing else regressed.** The layouts hold at both widths. Dark mode is warm charcoal everywhere, and the board dims as intended. The decision list now wraps long moves onto a second line instead of clipping the loss, which is the right trade-off.

---

## (c) Deviations

| # | Verdict | Reason |
|---|---|---|
| 1 | ~~Accept~~ **Superseded: implement now** | Taken on its merits, it was acceptable. The user has since asked for the mockup's geometry. See `reports/2026-10-08-design-fidelity-spec.md` §2. |
| 2 | **Accept** | I re-computed it: the report's dark `#D3203F` is about 2.8:1 on the dimmed bone `#C9BC9F`, and the new `#A8162F` is about 4.0:1. The developer was right. The bone halo covers the dark points. |
| 3 | **Superseded: implement now** | The user wants it now. The fixes for both blockers (a native `<dialog>` or a portal, `scroll-padding-top`, and Playwright `stylePath`) are in the fidelity spec, §3.3. |
| 4 | **Superseded: implement now** | Fidelity spec §4.2, "Grade". The back face at 390 still puts the ratings about 1,480 CSS px down. |
| 5 | **Accept** | It's correct in Galaxy's vocabulary. Finish it by giving the arrow a Good tier as well (b4). |
| 6 | **Fix now** | All S effort and independent of themes. The changes are `DecisionCard.tsx:43` (`|error|` becomes "Loss"), `app/matches/analysis/page.tsx:155` (`toISOString()` becomes a formatted date), and CHECKER/CUBE and `checker` going through the label maps. Do it before Phase 2 so the new themes aren't judged with raw strings on screen. |
| 7 | **Accept** | It only appears on row hover. The selected row deliberately uses `ink-muted` (`DecisionList.styles.ts`, `indexCell` comment). |

---

## (d) Fix list

### Before Phase 2 (all S, each one its own spec)

1. **Add a scrim token** and use it in `modalOverlay` (b2). Files: `app/themes/clubroom.css`, `app/globals.css`, `lib/styles/shared.styles.ts:105`.
2. **Add primary-action tokens:** `--primary`/`--on-primary`, used by `buttonPrimary`, `modalPrimaryButton` and the rating "Good"/"Next" buttons, instead of `bg-ink text-paper` (`shared.styles.ts:40`, `:112`). Midnight Felt will want a brass primary, and Quiet Ink perhaps an indigo one. Clubroom keeps ink.
3. **Fix the clipped mobile dashboard table** (b1). Files: `shared.styles.ts` (table cell padding below `sm`), the dashboard page's date format.
4. **Make played-move tiers consistent:** `playedMoveTier(null)` returns `"best"` (after the investigator confirms what null means), and add a Good arrow tier (b3, b4). Files: `lib/badges.ts`, `BoardPanel.tsx`, `BoardPanel.styles.ts`, `clubroom.css`.
5. **Add checker ring tokens:** `--checker-mine-ring`/`--checker-opp-ring` replace `stroke-white/15`/`stroke-black/12` (`BoardPanel.styles.ts:66`). Lighten the dark-mode mine rim in the same change (b5).
6. **Copy polish** (deviation 6).
7. **Guard the duplicated dark blocks with a test.** `clubroom.css:96` and `:133` must stay identical, and with three themes there will be six such blocks. Add a small unit test that parses each theme file and asserts that its `[data-mode="dark"]` and `system` blocks match. Also assert that every theme defines the full variable list from the `clubroom.css` header.

### Can wait for Phase 4 (design-system doc and shared components)

- Right-aligned numeric columns through `shared.tableCellNumeric` on matches, analysis and the dashboard.
- One chip font everywhere (sans), and the baseline alignment of title-row links.
- The remaining layout items from the original plan: navbar sticky plus mobile sheet (#10), shared filter bar and table components (#11), the calm review session with a sticky mobile rating row (#12), replay layout (#13), and the narrow-screen pass with the match-page board above the fold (#14).
- Unique SVG marker ids: use `useId` for `board-arrowhead` (`Board.tsx:282`). Today every page renders one board, but two boards on one page would share the first board's arrowhead colour.

---

## (e) Phase 2 readiness

**Grep results** for every `.ts`/`.tsx` under `app/` and `lib/`, tests excluded:
- **Hex values:** one, in a comment (`shared.styles.ts:10`).
- **Raw palette classes:** two, the checker rings `stroke-white/15` and `stroke-black/12` (`BoardPanel.styles.ts:66`).
- **`dark:` variants:** zero in use.
- **Inline `className="…"` in JSX:** none.
- **Raw `var(--…)` uses:** all reference theme variables. These are the `shadow-[inset_3px_0_0_var(--best)]` bars in `BoardPanel.styles.ts:43-46` and `review.styles.ts:57,60`, plus `lib/checkerPalette.ts`. All of them follow the theme.

**Theme-specific assumptions that would break or look wrong in Quiet Ink or Midnight Felt:**

1. **`bg-ink/40` scrim:** wrong in any dark mode (fix d1).
2. **`bg-ink text-paper` as "primary":** it assumes the primary action is always the ink colour (fix d2).
3. **Checker rings:** they assume "mine" is dark and "opponent" is light (fix d5). Quiet Ink's monochrome checkers and Midnight Felt's ivory and oxblood both need their own ring values.
4. **Fonts:**
   - `app/layout.tsx` loads every font for every theme, and `next/font` preloads by default (`preload` defaults to `true`, per `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`, "preload"). Adding Midnight Felt's Playfair, Inter and JetBrains Mono would preload six families on every page. Set `preload: false` on fonts that aren't the default theme's.
   - Quiet Ink has no serif (`fonts.serif: null` in `lib/themes.ts`), so its `--theme-font-serif` must point at Geist. The `font-serif` roles (titles, figures, notes, the italic verdict) then render in Geist. The verdict's `italic` in particular may need a per-theme override, or a `--theme-verdict-style` variable.
5. **The type scale is global** (`@theme` in `globals.css`), and its tracking (`-0.018em` display) is tuned for Newsreader. It's acceptable for Geist. Playfair, though, is high-contrast and wide, and will want different display tracking and sizes. Consider moving `--text-display--letter-spacing` and `--text-figure--letter-spacing` into the theme files.
6. **Severity fills are the same in every theme.** That's intended, but Midnight Felt must set its own `--best-tint`/`--error-tint`/`--blunder-tint` and `arrow-*` for felt, and my original report already flagged that the green Best arrow nearly disappears on baize. Check this first when Midnight Felt is built.
7. **The theme contract has no enforcement.** The only list of variables is a comment in `clubroom.css`, so a missing variable in a new theme fails silently, falling back to the inherited value or transparent. This is covered by d7's test.

Everything else is ready: the registry, `data-theme`/`data-mode`, the `@custom-variant dark`, `color-scheme`, and the board, which is fully on tokens, including the dice through `checkerPalette`.

---

## Open questions

- I couldn't test focus rings or the keyboard-reachable rows by eye. No screenshot shows a focused state, and I'm not allowed to run the app. I checked them in code only: the global `:focus-visible` rule and `focusRingInset`.
- b3 needs the investigator to confirm that `severity === null` on a played decision always means "Best" (loss 0) and never "ungraded".
- I computed the contrast ratios by hand from the hex values (WCAG 2.x). The arrow ratios in (c) are approximate to ±0.1.
