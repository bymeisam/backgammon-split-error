# Design review: Sources page, navbar after the sync line, review back Yours/Best tabs

2026-10-09 · designer · commits 01eeb64, 2767b3d

Screenshots: `design/screenshots/2026-10-09-sources/{clubroom,quiet-ink,midnight-felt}/` (cited below as `<theme>/<file>`). Code read at `master` f6baad2.

## Verdicts

| # | Point | Verdict |
|---|---|---|
| 1 | Sources page and card | **Works, but thin.** The status line repeats itself and hides the exact time in a tooltip. The card is a narrow left column inside an 896px box. Fix the wording and use a two-row card. |
| 2 | Yours/Best tabs | **The tabs are right, but the screen contradicts them.** The Yours tab says **Error** (amber) while the options row and the verdict paint the same answer **Blunder** red. Also: identical tabs when your answer is the best, and a "BEST · Best" double label. |
| 3 | Menu breakpoint `xl` to `lg` | **Yes, but only with the brand text hidden from lg to xl.** The 65–83px measured at 1024 doesn't survive the longest mode label plus a 3-digit due count. The exact classes are below. |
| 4 | Sources in the nav | **Move it into the end group** (Sources · Settings · Status). It's an admin page, not a study page. |

---

## 1. Sources page and card

**What the screenshots show**
- `clubroom/sources--1440-light--full.png`, `midnight-felt/sources--1440-dark--full.png`: the content is one left-aligned column about 520px wide inside an 896px card (PageShell `medium`), with an empty right half. The hierarchy is fine: serif title, muted description, overline, then buttons. All three themes and both modes read cleanly, and the primary/secondary buttons are distinct in each (clubroom dark: tan primary on felt; quiet-ink: black/white).
- `quiet-ink/sources--390-light--full.png`: stacks well. The two buttons fit on one row at 390, and nothing breaks.
- `clubroom/sources-add-token--1440-dark--viewport.png`: the modal is fine, and Cancel is present here. On `/sources/galaxy/matches` the same modal has no Cancel (`quiet-ink/sources-galaxy-matches--1440-light--viewport.png`). That's acceptable, because the page needs a token, but it's an inconsistency worth knowing about.
- **The status line repeats itself** (`lib/sources.ts:39-42`, `app/sources/page.tsx:39-44`). The overline says "LAST SYNCED" and the value starts "Synced …". "· 28 matches" is also ambiguous: it's `SyncRun.matchesSynced` for **the last run** (`lib/dashboardStats.ts:67-74`), but it reads like a library total. The exact time is only in a `title` tooltip, which never shows on touch.

**Proposed wording (no new data).** Split the one line into labelled facts:

| Overline | Value | Detail line (small, faint) |
|---|---|---|
| LAST SYNC | `4 days ago` | `5 Oct, 14:32` (the exact time, visible, not a tooltip) |
| LAST SYNC ADDED | `28 matches` (or `No new matches` at 0) | none |

The edge states:
- **Never synced:** LAST SYNC `Never`, and drop the second item.
- **Lookup failed:** LAST SYNC `Unknown`.

Before the developer uses "added", the investigator should confirm that `matchesSynced` counts *new* matches. If it counts every match processed, use "LAST SYNC FETCHED".

**Should the card show more?** Yes. The most useful extras are a library total, the latest match played and the failures from the last sync. All three need data the card doesn't read today; see "Needs approval".

**Layout (S–M).** Title and description on the left, actions top-right from md, then a status row of `dl` items. Below md it stacks exactly as today.

`app/sources/sources.styles.ts`:
```ts
card: "flex flex-col gap-4 p-5",
// Title + description left, actions right from md; stacked below.
cardTop: "flex flex-col gap-4 md:flex-row md:items-start md:justify-between",
cardHeader: "flex flex-col gap-1",
cardTitle: shared.pageSectionTitle,
cardDescription: shared.mutedText,
// The status facts as a <dl>: two per row on a phone, one line from sm.
statusList: "grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 sm:flex sm:flex-wrap sm:gap-x-10",
statusItem: "flex flex-col gap-0.5",
statusLabel: shared.overline,            // <dt>
statusValue: "text-sm tabular-nums text-ink",   // <dd>
statusDetail: "text-xs tabular-nums text-ink-faint",
actionsBlock: "flex flex-col gap-3 md:items-end",
actionsRow: "flex flex-wrap items-center gap-2",
syncMessage: (ok: boolean): string => clsx("text-sm", ok ? "text-ink-muted" : "text-blunder-ink"),
```
- **`lib/sources.ts`:** `SourceStatus` becomes `{ items: { label: string; value: string; detail?: string }[] }`, and `galaxyStatus` returns the items above.
- **`page.tsx`:** renders `<dl className={style.statusList}>` with one `<div className={style.statusItem}>` (holding `dt` and `dd`) per item, and wraps the header and Actions in `cardTop`.
- **The sync message:** a success message in Best's green is severity colour used for "OK" (design-system §"Don't use colour except severity and the accent"). Make success neutral. Failure can stay blunder-ink, the same as `shared.errorBox`.

---

## 2. Review back: Yours/Best tabs

**Tier rule.** The rule that a wrong answer is Error, never Blunder (`lib/badges.ts` `reviewAnswerTier`) is sound. The review grading has one boundary (0.02), and Galaxy's error/blunder line is Galaxy's own classification, not a threshold the app can apply to an option (`lib/mistakes.ts:28-45`). Keep it.

**The problem is that the rest of the back disagrees.**
- `clubroom/review-card2-back-incorrect-yours--1440-light--viewport.png`, `midnight-felt/…--1440-dark--viewport.png`, `quiet-ink/review-card2-back-incorrect--1440-light--viewport.png`: the Yours tab, its chip and the arrow are **amber, Error**. The same answer's row in the options table is **Blunder pink with a red bar and red loss**, and "Not quite." is Blunder red. One answer gets two severities on one screen.
- The causes are `app/review/review.styles.ts:62-86`: `optionRow` uses `bg-blunder-tint`, `optionCell` uses `--color-blunder` and `optionLoss` uses `text-blunder-ink`, all hand-picked. `verdictWord` at `:47-51` uses `severityText("blunder")`.

**Fix 2a (S): one tier for the answer everywhere.** Compute `answerTier = reviewAnswerTier(isBest, correct)` once in `ReviewSession.tsx` and pass it in:
```ts
// review.styles.ts
optionRow: (opts: { isBest: boolean; isChosen: boolean; correct: boolean }): string =>
  clsx(
    opts.isBest && "bg-best-tint",
    opts.isChosen && !opts.isBest && (opts.correct ? "bg-sunken" : "bg-error-tint")
  ),
optionCell: (opts: { isBest: boolean; chosenWrong: boolean }): string =>
  clsx(
    "border-t border-line px-4 py-[9px] font-mono text-[13.5px] font-medium text-ink",
    opts.isBest && "shadow-[inset_3px_0_0_var(--color-best)]",
    opts.chosenWrong && "shadow-[inset_3px_0_0_var(--color-error)]"
  ),
optionLoss: (chosenWrong: boolean): string =>
  clsx(
    "border-t border-line px-4 py-[9px] text-right font-mono text-[13.5px] font-medium tabular-nums",
    chosenWrong ? shared.severityText("error") : "text-ink-muted"
  ),
verdictWord: (correct: boolean): string =>
  clsx(
    "font-serif text-[28px] font-display font-emphasis leading-none",
    shared.severityText(correct ? "best" : "error")
  ),
```
This also makes the back calmer: red then appears only where Galaxy itself said Blunder. (Recolouring the verdict word is a user call; see the open questions.)

**Fix 2b (S): when your answer *is* the best, show one chip, not two identical tabs.** `clubroom/review-card1-back-correct-yours--1440-light--viewport.png` shows "YOURS Best 8/4* 6/5*" next to "BEST Best 8/4* 6/5*", and switching does nothing. When `isBest`, render one static `DecisionChip` labelled "Yours · Best" with no tablist, and stop h/l from switching. In `BoardPanel.styles.ts`, `decisionRow` takes a `single` flag: `clsx("grid gap-2.5", single ? "grid-cols-1" : "grid-cols-2", bleed && "mx-3 md:mx-0")`.

**Fix 2c (S): drop the duplicate label.** "BEST [Best]" says the same word twice, and so does "PLAYED [Best]". In `BoardPanel.tsx:37-40`, render `<SeverityBadge>` only when the tier's label differs from the tab label (`SEVERITY_TIER_LABELS[tier] !== label`). The same applies to the Played/Best tabs on match pages.

**Tab colours otherwise.** Active is tinted, with a 3px bar and a /70 border. Inactive is the surface at 85% opacity. That reads as a tablist in both modes and all three themes, and the 390 shot (`quiet-ink/review-card2-back-incorrect-yours--390-dark--viewport.png`) is clear. One gap: there is no `good-tint` token (`app/globals.css:59-61`), so an active **Good** tab is `bg-surface` with only a slate bar, which is barely different from an inactive tab. No screenshot shows a Good answer. Suggested: in `decisionChip`, change `opts.tier === "good" && "border-good/70 bg-surface …"` to `bg-sunken`.

---

## 3. Navbar: Menu breakpoint `xl` to `lg`

**The arithmetic.** At 1024 the write-mode row needs 941–959px (from `nav-metrics-write.json`), leaving 65–83px. Those measurements were taken with the **shortest** label, "Local · write" (`*/nav-write-top--1280-light--viewport.png`), and a **1-digit** due badge. The worst case is larger:
- `Writes: Oracle · Reads: Local`: about 16 more characters at 12.5px, so about +85px (measured from "Local · write" at about 69px in `clubroom/sources--1440-light--full.png`).
- A 3-digit due count: about +13px.

That's about 98px against 65px of spare space, an overflow of about 33px in midnight-felt. A classic 15px scrollbar (Windows) makes it worse. So a plain swap fails.

**The fix: hide the "Game Review" wordmark between lg and xl and keep the checker mark.** That frees about 121px (111px of text plus the 10px gap, from `clubroom/sources--1440-light--full.png`). The worst case is then about 65 + 121 − 98 ≈ 88px spare, still about 73px with a classic scrollbar. Below lg the Menu layout is unchanged, so the wordmark returns. From xl the bar is unchanged.

Exact changes in `app/components/ui/AppNav.styles.ts`:
- **The breakpoint:** replace every `xl:` with `lg:` in `inner` (`lg:gap-6`), `modeBadge` (`inline-flex lg:hidden` / `hidden lg:inline-flex`), `narrowEnd` (`lg:hidden`), `menu` (the whole third clsx line, `lg:static lg:flex … lg:shadow-none`), `list`, `item`, `itemWithChildren`, `link`, `subList`, `subLink`, `endGroup`, `footRow` and `helpButton` (`lg:ml-0`). Keep the `md:` panel classes in `menu` as they are; they now apply from md to lg only.
- **The wordmark:** add `brandText: "lg:max-xl:sr-only"`. In `NavLinks.tsx:100-103`, wrap the text as `<span className={style.brandText}>Game Review</span>`. The link keeps its accessible name, and the absolutely-positioned sr-only span takes no flex gap.
- **The comments:** update the comments that say "below xl / from xl".
- **Outside the styles file:** `scripts/design-screenshots.ts:446` becomes `variant.width < 1024` so the review dropdown is shot at 1024, and the "Below xl" comments at `:16, :117, :341, :369-375` change to match. `docs/design-system.md` gets the same wording change.

The dropdown at lg on touch: an iPad in landscape (1024) can't hover Review › Cards. Cards is still reachable through "Manage cards" on /review (`clubroom/review-card2-back-incorrect-yours--1440-light--viewport.png`), so this is acceptable.

## 4. Other findings

- **Sources' place in the nav (S).** In `*/nav-write-top--1280-*.png` and `quiet-ink/nav-menu-open--390-dark--viewport.png`, Sources sits after Review among the study pages, but it's an admin page you visit to sync. In `lib/navItems.ts`, give it `end: true` and put it before Settings, so it renders as "Sources · Settings · Status". In the 390 sheet's foot row it becomes the first of three short words, which fits. On `/sources/**`, Sources' active state then uses `endLink(true)` (`text-ink`), the same as Settings. That's quieter than the underline, but consistent. Update `lib/navItems.test.ts`.
- **The breadcrumb on `/sources/galaxy/matches`** (Sources › Galaxy › Matches) is fine.

## Fixes, in priority order

| # | Fix | Effort | Files |
|---|---|---|---|
| 1 | 2a: the answer is one tier (Error) in the options row, the loss and the verdict | S | `app/review/review.styles.ts`, `app/review/ReviewSession.tsx` |
| 2 | Menu `xl` to `lg`, with the wordmark sr-only from lg to xl | S | `AppNav.styles.ts`, `NavLinks.tsx`, `scripts/design-screenshots.ts`, `docs/design-system.md` |
| 3 | Source card status wording: LAST SYNC / LAST SYNC ADDED, with the exact time visible | S | `lib/sources.ts` (+ test), `app/sources/page.tsx`, `sources.styles.ts` |
| 4 | 2b: a single chip when your answer is the best | S | `BoardPanel.tsx`, `BoardPanel.styles.ts`, `ReviewSession.tsx`, `lib/reviewKeys.ts` |
| 5 | Sources moves to the nav's end group | S | `lib/navItems.ts` (+ test) |
| 6 | 2c: no duplicate label and badge; Good's active tab on `bg-sunken` | S | `BoardPanel.tsx`, `BoardPanel.styles.ts` |
| 7 | Source card two-row layout; neutral sync-success text | S | `app/sources/page.tsx`, `sources.styles.ts` |

## Needs approval (new data or queries)

1. **A library total on the card:** "IN LIBRARY 1,284 matches", from a new count of `Match` for this source. It's a new read query on `/sources`.
2. **The latest match played:** "LATEST MATCH 5 Oct", from `max(Match.playedAt)` for the source. It's a new query.
3. **Failures from the last sync:** "2 failed" in blunder-ink, from `SyncRun.matchesFailed`. The column exists, but `latestFinishedSyncRun` (`lib/dashboardQueries.ts:16-23`) doesn't select it.
4. **Per-source sync status:** `SyncRun` has no `source` column, so "last sync" is global. That's fine with one source, but a second source would need a schema change.

## Open questions

- Is "Not quite." in Error amber (2a) acceptable, or should the verdict stay red as a right/wrong signal separate from the tier? I recommend amber, for one colour per answer.
- Does `matchesSynced` count new matches or every match processed? This decides between "ADDED" and "FETCHED"; it's an investigator question.
- Not seen: a Good (correct, not best) back; the nav with a dual-database label or a 2–3 digit due count; the card after a sync (message and refreshed status together); the Never-synced state. After fix 2, re-shoot at 1024 with `Writes: Oracle · Reads: Local` (that needs the user's env) to confirm `overflow: 0`.
