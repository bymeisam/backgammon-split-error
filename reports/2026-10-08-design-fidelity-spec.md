# Clubroom fidelity spec (2026-10-08)

**Purpose.** The user wants the app to match the mockups faithfully: `design/mockups/dashboard.html`, `review-card.html` and `replay.html`. This file lists every visible difference between the Phase 1 screenshots (`design/screenshots/2026-10-08-phase1/`) and those mockups, with the exact values to use. It sits alongside `reports/2026-10-08-design-review-phase1.md`, which still applies, especially its fix list (d) and Phase 2 notes (e).

**Conventions.**
- Values come from the mockups' CSS and SVG unless a line says *(designer's correction)*.
- Colours are token names from `app/themes/clubroom.css` (`ink-muted` means `text-ink-muted` and so on).
- "px" means CSS pixels. "u" means board viewBox units.
- Every class string belongs in a `.styles.ts` file under the `styling-conventions` skill: one `style` object, `clsx` for conditionals, typed functions, and cross-cutting values only in `lib/styles/shared.styles.ts`.

**Order to build:**
1. Tokens and shared primitives (§1).
2. Board (§2), since every board page depends on it.
3. Navbar (§3).
4. Replay (§4.3), which sets the board-page pattern.
5. Review (§4.2).
6. Dashboard (§4.1).
7. The pages that have no mockup (§5).

Each numbered block below is sized to be one developer spec.

---

## 1. Tokens and shared primitives

### 1.1 New tokens (`app/themes/clubroom.css`, mapped in `app/globals.css`)

| Variable | Light | Dark | Used by |
|---|---|---|---|
| `--scrim` | `rgb(29 27 23 / .40)` | `rgb(0 0 0 / .60)` | modal overlay (it currently uses `bg-ink/40`, which is a cream wash in dark mode) |
| `--primary` / `--on-primary` | `var(--ink)` / `var(--paper)` | same | primary buttons (so other themes can change it) |
| `--nav-bg` | `color-mix(in srgb, var(--surface) 88%, transparent)` | same | translucent navbar |
| `--checker-mine-ring` | `rgb(255 255 255 / .16)` | same | checker turned ring |
| `--checker-opp-ring` | `rgb(0 0 0 / .12)` | same | |
| `--arrow-good` | `#4E5D72` | `#3F4B5C` | arrow for a played "Good" move. Check it's at least 3:1 on bone in both modes. |
| `--die-stroke` | `rgb(0 0 0 / .35)` | same | board dice outline |

Expose them as `--color-scrim`, `--color-primary`, `--color-on-primary`, `--color-nav-bg`, `--color-checker-mine-ring`, `--color-checker-opp-ring`, `--color-arrow-good` and `--color-die-stroke`.

### 1.2 Shared primitives (`lib/styles/shared.styles.ts`): changed values

| Key | New classes | Mockup source |
|---|---|---|
| `buttonPrimary` | `buttonBase h-[38px] px-4 text-[13.5px] bg-primary text-on-primary border border-primary hover:bg-primary/86` | dashboard `.btn`, `.btn-primary` |
| `buttonSecondary` | `buttonBase h-[38px] px-4 text-[13.5px] border border-line-strong bg-surface text-ink hover:bg-sunken` | dashboard `.btn` |
| `buttonCompact` (new; replaces in-card uses of primary/secondary) | `buttonBase h-[34px] px-3.5 text-[13px] border border-line-strong bg-surface text-ink hover:bg-sunken` | replay `.btn` |
| `buttonCompactPrimary` (new) | same as `buttonCompact` plus `bg-primary text-on-primary border-primary` | replay `.btn-primary` |
| `pill` (new: filter toggles, tag chips) | `inline-flex items-center rounded-full border border-line bg-surface px-2.5 py-1 text-[12.5px] text-ink-muted hover:border-line-strong hover:text-ink` | review `.filters button` |
| `tagChip` (new) | `inline-flex items-center rounded-full border border-line bg-sunken px-[9px] py-[3px] text-xs text-ink-muted` | `.tag` |
| `tagChipAdd` (new) | `inline-flex items-center rounded-full border border-dashed border-line px-[9px] py-[3px] text-xs text-ink-muted cursor-pointer` | `.tag.add` |
| `textLink` | add `text-[13px]` | `.link` |
| `card` | unchanged (`rounded-card border-line bg-surface shadow-card`) | `.card` |
| `overline` | `text-overline uppercase text-ink-faint` (11px, 600, `.09em`), unchanged | `.overline` |
| `severityChip(tier)` base | `inline-flex items-center rounded-[4px] px-1.5 py-[3px] font-sans text-[10.5px] font-semibold leading-none tracking-[0.02em]`, plus the tier fill and `on-*` text. **Always sans.** In the decision list today it renders mono. | `.sev` |
| `codeChip` (new: classification codes OG, MG, BLZ…) | `inline-flex items-center rounded-[4px] border border-line-strong px-[5px] py-[3px] font-mono text-[10.5px] font-semibold leading-none text-ink-muted` | dashboard `.code` |
| `kbd` | `rounded-[4px] border border-b-2 border-line-strong bg-sunken px-[5px] py-[2px] font-mono text-[11px] font-medium leading-none text-ink-muted` | replay `.kbd` |
| `tableHeadCell` | `px-[18px] pt-3.5 pb-2.5 text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-ink-faint border-b border-line` | dashboard `.table th` |
| `tableCell` / `tableCellMuted` / `tableCellNumeric` | `px-[18px] py-[11px] text-[13.5px]`, with `text-ink` / `text-ink-muted` / `text-right tabular-nums`. Below `sm`, `px-3.5`. | `.table td` and the `@media` block |
| `tableRowClickable` | add `hover:[&>td]:bg-sunken`, and make the whole row the link target | `.table tbody tr:hover td` |
| `modalOverlay` | `bg-scrim` instead of `bg-ink/40` | (bug fix) |

**Number formatting rule:** numbers are sans with `tabular-nums lining-nums`. Losses and equities are mono and use a real minus sign (U+2212): `−0.168`, not `-0.168` or `(0.168)`.

---

## 2. The board

Source: the `board()` function, identical in `replay.html:272-301` and `review-card.html:310-339`. The app keeps its behaviour:
- the decision-maker ("mine") is always drawn at the bottom;
- a flipped board swaps the data, not the geometry;
- the offered cube appears on takes and passes;
- cube ownership decides the cube's position;
- dice are drawn in roll order;
- arrows come from `moveAnchor` on the real sub-moves;
- the off-tray shows the borne-off count;
- `×N` labels and hit markers stay.

Only geometry and drawing change.

### 2.1 Geometry: `lib/boardGeometry.ts`

The viewBox becomes **`0 0 562 380`**. Remove `FRAME` and the extended viewBox in `Board.tsx`, because the numbers now sit in the board's own 20u band.

| Constant | Now | New | Derivation (mockup) |
|---|---|---|---|
| `MARGIN` (vertical frame) | 16 | **split into `MARGIN_Y = 20` and `MARGIN_X = 14`** | `Y0=20`, `H−Y1=20`; right frame 562−548 = 14 |
| `CUBE_COL_W` | 32 | **30** | `GRID_X0 = MARGIN_X + 30 = 44 = LX` |
| `POINT_W` | 48 | **36** | `PW=36` |
| `BAR_W` | 32 | **30** | bar 260→290 (`RX − LX − 216`) |
| `OFF_W` | 44 | **42** | 506→548: an 8u frame gap plus the 34u tray at `TX=514` |
| `ROW_H` | 185 | **170** | (360−20)/2 |
| `TRI_H` | 165 | **148** | `Y0+148` |
| triangle half-width | `w/2 − 2` = 22 | **17** (`POINT_W/2 − 1`) | `x±17` |
| `R` | 14 | **15** | `r="15"` |
| checker ring | `R − 5` | **9.5** (`R − 5.5`), stroke 1 | `.ring r=9.5` |
| checker rim stroke | 1.2 | 1.2 | `.ck circle{stroke-width:1.2}` |
| `STACK_GAP` | 24 | **32** (the checkers no longer overlap; there's a 2u gap) | `k*32` |
| stack base | `Y1 − R − 3` / `Y0 + R + 3` | **`Y1 − R − 2` / `Y0 + R + 2`** (= 343 / 37) | `Y1−17`, `Y0+17` |
| `MAX_STACK` | 5 | 5 | `Math.min(n,5)` |
| `BOARD_W` × `BOARD_H` | 716 × 402 | **562 × 380** | `W`, `H` |

Check the results: `colX(0)=44`, `colX(BAR_COL)=260`, `colX(BAR_COL+1)=290`, `colX(OFF_COL)=506`, `BOARD_W = 506 + 42 + 14 = 562`, `Y1 = 20 + 340 = 360`.

### 2.2 Drawing: `Board.tsx` and `BoardPanel.styles.ts`

Draw in this order, which is the same as the mockup.

1. **Frame.** A rect `0,0,562,380`, `rx=14`, `fill-board-frame`. The SVG has `drop-shadow(0 14px 22px var(--board-shadow))`, as `boardSvg` already does.
2. **Bone.** Two rects, `x=44` and `x=290`, `y=20`, `w=216`, `h=340`, `rx=2`, `fill-board-bone`. The bar (260–290) and the 506–514 gap stay frame-coloured. There's no bar rect.
3. **Off trays.** Two rects, `x=514`, `w=34`, `rx=3`, `fill-board-tray`: the top one at `y=20, h=166`, the bottom one at `y=194, h=166`. That leaves an 8u frame gap centred on y=190.
4. **Points.** Polygon `x−17,base x+17,base x,apex`, with the apex at `Y0+148` (top) or `Y1−148` (bottom). The colour flips: **odd points are `fill-board-point-dark`, even points `fill-board-point-light`** (mockup `p%2?'pa':'pb'`; the app is the other way round today).
5. **Point numbers.** In the frame band, centred on y=10 (top) and y=370 (bottom), with `dominant-baseline="central"`, `text-anchor="middle"`, `fill-board-number`, Geist 500 and `tabular-nums`. The size is **10u at `sm`+** (as in the mockup). Below `sm` it's **15u** *(designer's correction: 10u renders about 6.7px on a 390 screen, which is unreadable; 15u still fits the 20u band)*. Class: `fill-board-number font-sans text-[15px] font-medium tabular-nums sm:text-[10px]`. Flipped boards keep printing `25 − p`.
6. **Checkers.** Circle `r=15`, `fill`/`stroke` from `CHECKER_PALETTE`, stroke 1.2. Then the ring: circle `r=9.5`, `fill-none`, stroke 1, `stroke-checker-mine-ring` or `stroke-checker-opp-ring`.
7. **Stack cap and "+N".** Draw `min(n, 5)` checkers. **All five keep their ring.** When `n > 5`, add text **`+{n − 5}`** centred on the 5th checker at `cy + 4`, Geist 600 11u, filled with the side's `contrast` colour.
   - **This changes the label's meaning.** Today it's `+{n − 4}` and replaces the 5th checker. Now the label means "this many more than shown".
   - `stackSlotY`'s clamp to `MAX_STACK − 1` stays as it is.
8. **Bar checkers.** These are unchanged in behaviour: they're centred on the bar column (x=275) and stack from each side's edge with the same base and gap.
9. **Off tray contents** (not in the mockup; keep the behaviour, restyled to fit the 34u tray):
   - `OFF_TRACK_X = 514 + 5`, `OFF_TRACK_W = 24`.
   - `offTrayBounds`: opponent `{topY: 24, bottomY: 182, badgeAtBottom: true}`, mine `{topY: 198, bottomY: 356, badgeAtBottom: false}`.
   - `offColumnGeometry`: `badgeR = 10`, 3u from the inner end, and a 5u gap between the badge and the track.
   - Slot slabs: `rx=1`, height `slotSpan − 1.5`. Empty slots get `stroke-board-number/25`.
   - Badge: Geist 600 11u.
10. **Cube** (owned or centred). Rect `26×26`, `rx=5`, at `x=16`; `fill` `--checker-opp`, `stroke` `--checker-mine`, 1.2. Text Geist 600 14u at `y+18`, in `--checker-mine`. Centre x = `MARGIN_X + CUBE_COL_W/2 = 29`. Its rect `y` is:
    - **centred** (no owner): 177 (centre 190);
    - **opponent owns:** `Y0 + 4 = 24`;
    - **mine owns:** `Y1 − 30 = 330`.

    In `cubeBadgeCenter` terms, set `CUBE_BADGE_R = 13`; centres are y = 190, 37 and 343.
11. **Offered cube on a take or pass** (behaviour kept: horizontally on the bar column, against the receiver's edge). Same 26u cube, centre `x=275`, `y = Y1 − 13 − 2 = 345` (mine) or `Y0 + 13 + 2 = 35` (opponent).
12. **Dice.** Draw them as native SVG (drop the `foreignObject` and HTML `DiceRoll`). The die size is **26u**, centred on y=190. The pair is centred on the right half's centre x = `(colX(BAR_COL+1) + colX(OFF_COL))/2 = 398`: die 1 at `x = 398 − 26 − 4`, die 2 at `x = 398 + 4` (8u apart), in roll order.
    - Die: rect `rx = 5.2` (`.2s`), fill from the mover's checker colour (mine when not flipped), `stroke-die-stroke`, width 1.
    - Pips: `r = 2.34` (`.09s`), filled with the opposite checker colour.
    - Pip layout as fractions of `s`: 1 `[.5,.5]`; 2 `[.28,.28][.72,.72]`; 3 the same plus centre; 4 the four `.28/.72` corners; 5 four corners plus centre; 6 `x∈{.28,.72} × y∈{.25,.5,.75}`.
    - Put this in a `BoardDie` subcomponent in `Board.tsx` (board-only). `Dice.tsx` stays for the lists (see §4.3, mini-dice).
13. **Arrows** (replace the `<marker>`, which also removes the shared `board-arrowhead` id). For each sub-move, take `(x1,y1)` = `moveAnchor(from, …, true)` and `(x2,y2)` = `moveAnchor(to, …, false)`, then:
    - `u = unit(x2−x1, y2−y1)`; `tip = (x2,y2) − 4u`; `base = tip − 13u`; `n = (−u.y, u.x)`.
    - **Halo:** a line from `(x1,y1)` to `base`, stroke 7.5, round cap, `stroke-board-bone`, opacity .75.
    - **Shaft:** the same line, `stroke=currentColor`, width **3.5**, round cap.
    - **Head:** polygon `tip, base + 7.5n, base − 7.5n`, `fill=currentColor`.
    - **Origin dot:** circle at `(x1,y1)`, `r=4`, `fill=currentColor`.
    - **Kept from the app** (not in the mockup): the hit marker becomes a dashed circle at the target, `r = R + 3`, stroke 1.75, `stroke-dasharray="3 2.5"`, `currentColor`. The `×N` label: Geist 600 11u, `currentColor`, with a 3u `stroke-board-bone` halo (`paint-order: stroke`).
    - **Colour:** the group `text-arrow-{best|good|error|blunder}`. Add `"good"` to `ArrowTier` and to `BoardPanel.tsx:73`. Use the played tier from `playedMoveTier` when the Played tab is shown.

### 2.3 `BoardPanel.styles.ts` keys (drop-in)

```ts
boardSvg: "block h-auto w-full drop-shadow-board",
boardFrame: "fill-board-frame",
boardSurface: "fill-board-bone",
boardTray: "fill-board-tray",
point: (isDark: boolean): string => (isDark ? "fill-board-point-dark" : "fill-board-point-light"), // isDark = point % 2 === 1
pointNumber: "fill-board-number font-sans text-[15px] font-medium tabular-nums sm:text-[10px]",
checkerRing: (side: "mine" | "opponent"): string =>
  clsx("fill-none [stroke-width:1]", side === "mine" ? "stroke-checker-mine-ring" : "stroke-checker-opp-ring"),
stackCount: "font-sans text-[11px] font-semibold",
cubeText: "font-sans text-[14px] font-semibold",
dieFrame: "stroke-die-stroke [stroke-width:1]",
arrow: (tier: ArrowTier): string =>
  clsx(
    tier === "best" && "text-arrow-best",
    tier === "good" && "text-arrow-good",
    tier === "error" && "text-arrow-error",
    tier === "blunder" && "text-arrow-blunder"
  ),
arrowHalo: "stroke-board-bone opacity-75 [stroke-width:7.5] [stroke-linecap:round]",
arrowShaft: "[stroke:currentColor] [stroke-width:3.5] [stroke-linecap:round]",
arrowHead: "fill-current",
arrowCount: "fill-current font-sans text-[11px] font-semibold stroke-board-bone [stroke-width:3] [paint-order:stroke]",
```

### 2.4 Tests

`lib/boardGeometry.test.ts`, the anchor tests and every `e2e/board-visual.spec.ts` baseline will change. The developer should update the numeric expectations from the table in §2.1 and regenerate the baselines. They should also say in the PR that the baselines changed for the geometry only.

---

## 3. Navbar: sticky and translucent (`AppNav.styles.ts`, `NavLinks.tsx`, `SyncControl.tsx`, `ShortcutsHelp.tsx`)

### 3.1 Wide (≥ md)

| Element | Value (mockup `.nav*`) |
|---|---|
| bar | `sticky top-0 z-40 border-b border-line bg-nav-bg backdrop-blur-[10px]` |
| inner | `mx-auto flex h-14 w-full max-w-[1240px] items-center gap-8 px-6` |
| brand | `flex items-center gap-2.5 whitespace-nowrap font-serif text-[20px] font-medium leading-none tracking-[-0.01em] text-ink` plus a **22px mark**: inline SVG `viewBox 0 0 24 24`, `<circle cx=9 cy=12 r=7.5 fill=currentColor/>` and `<circle cx=15.5 cy=12 r=7 fill=var(--surface) stroke=currentColor stroke-width=1.5/>` (two checkers) |
| links | `flex h-full gap-[22px]` |
| link | `flex h-full items-center gap-1.5 border-b-2 -mb-px text-[13.5px] font-medium`; active `border-ink text-ink`; idle `border-transparent text-ink-muted hover:text-ink` |
| end group | `ml-auto flex items-center gap-4 whitespace-nowrap text-[12.5px] text-ink-faint` |
| **mode badge** | **moves from beside the brand into the end group, first item.** Dot 7px (`before:h-[7px] before:w-[7px]`), `font-medium text-ink-muted` |
| sync text | "Synced 3 days ago · 28 matches" (drop "Last") |
| "Add token to sync" | `underline decoration-line-strong underline-offset-[3px]` |
| `?` button | `inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-line text-[13px] font-semibold text-ink-muted hover:bg-sunken hover:text-ink` |

### 3.2 Narrow (< md)

The bar shows the brand, then (at the right) the mode badge and a `Menu` button (`h-[30px] rounded-[8px] border border-line px-3`). The open menu is a full-width sheet under the bar, with `bg-surface` (opaque) and `shadow-raised`:
- the nav links as 44px rows (`h-11 px-4`); the active one gets a 2px `ink` left bar; Review › Cards is indented by 16px;
- a hairline;
- one row: "Synced 3 days ago · 28 matches" plus the sync link;
- a footer row with `flex justify-between`: "Status" on the left and the `?` button on the right (this replaces today's uneven separate rows).

### 3.3 The two blockers the developer hit, and their fixes

1. **The `?` dialog is pinned to the bar.** `backdrop-filter` makes the nav the containing block for `position: fixed` descendants, so the overlay inside the bar takes the bar's box. **Fix:** render the dialog outside the nav.
   - **Preferred:** a native `<dialog>` opened with `showModal()`. It goes to the browser's top layer, which escapes any containing block. It also gives focus trapping, `Esc` and `::backdrop` for free. Style `::backdrop` with `bg-scrim backdrop-blur-[2px]`.
   - **Alternative:** `createPortal(overlay, document.body)` from `react-dom`, keeping today's markup and `z-50`.

   The same applies to the "Add all to review" and "delete card" modals and to `TokenModal`. They're rendered in page content, so they're not affected today, but use the same mechanism for consistency.
2. **Visual tests: the sticky bar covers element screenshots.**
   - (a) Add `html { scroll-padding-top: 72px }` in `globals.css` `@layer base`, so `scrollIntoView`, `Tab` focus and anchor jumps land below the bar. This also helps real users.
   - (b) In the Playwright config, set `expect: { toHaveScreenshot: { stylePath: "e2e/screenshot.css" } }` with `e2e/screenshot.css` containing `header[data-app-nav] { position: static !important; }`. Playwright 1.63 is installed, and `stylePath` is a supported `toHaveScreenshot` option. It applies only while screenshotting, so the app is untouched.
   - Add `data-app-nav` to the nav's `<header>`.

---

## 4. Screens with a mockup

### 4.1 Dashboard (`app/page.tsx`, `app/home.styles.ts`)

| Area | Phase 1 now (`dashboard--1440-light--full`) | Mockup value |
|---|---|---|
| Page | content capped at about 896px | **full 1240px shell**, `px-6 pt-11 pb-[72px]`, sections `flex flex-col gap-9` |
| Header | h1 plus lede | **overline date above the h1**: "Thursday 8 October" (`overline`, today in the user's locale). h1 `font-serif text-display` (38/1.08, 500, `-.018em`) with `mt-2.5`. Lede `mt-2 text-[14.5px] text-ink-muted`. |
| Widget grid | 3 equal columns | `grid grid-cols-[1.25fr_1fr_1fr] gap-[18px]`; below md, `grid-cols-1` |
| Widget | `p-5` | `card flex min-h-[200px] flex-col gap-3 px-[22px] pt-[22px] pb-5` (below md, `min-h-0`) |
| Due widget | "CARDS DUE TODAY", 3, "Review now →" | overline "Due today". Figure: `font-serif text-figure` "3" followed by `<small>` "cards" (`ml-1.5 font-sans text-base font-normal text-ink-muted tracking-normal`). A split line, `flex gap-4 text-[13px] text-ink-muted` with numbers `font-semibold text-ink`: "**3** new **0** review". Actions pinned to the bottom (`mt-auto flex items-center gap-3.5`): `buttonPrimary` "Start review →" plus `textLink` "Manage cards". |
| Mistakes widget | table, no colour | overline "Your mistakes · last 7 days". Mini table at 13px: th `text-[11.5px] font-medium text-ink-faint text-right pb-1.5`, each with a 7px severity square (`rounded-[2px] bg-error` / `bg-blunder`, `mr-1.5`); td `py-1.5 text-right tabular-nums border-t border-line`, first column left in `ink-muted`; the total row `font-semibold text-ink`. **New stacked bar:** `flex h-1.5 overflow-hidden rounded-[3px] bg-sunken`, error segment `bg-error`, blunder segment `bg-blunder`, widths are each total's share. Meta `text-[12.5px] text-ink-faint`. |
| Rating widget | `1,853.21` all ink | integer part in ink and **".21" in `ink-faint`**. Meta "After match" plus the **match id as a `textLink`** to `/matches/[id]`. |
| Lower row | full-width table | `grid grid-cols-[2fr_1fr] gap-[18px] items-start`: Latest matches on the left, Most repeated blunders on the right (**needs approval**, §6). Without approval, the table spans the full width. |
| Section head | h2 plus link | `flex items-baseline justify-between gap-4 mb-3.5`; h2 `font-serif text-heading` (22px, 500, `-.01em`) |
| Latest matches table | DATE, OPPONENT, SCORE, YOUR ERROR | columns **Date · Opponent · Score · Your PR (right) · chevron**. Date "5 Oct" (with the year only if it isn't this year), `tabular-nums text-ink-muted`. Opponent `font-medium`. PR to **2 decimals** with a bar before it (`flex items-center justify-end gap-2.5`; bar `block h-1 rounded-[2px] bg-line-strong`, `width = min(PR × 5, 100)px`). Chevron column `w-7 text-right text-ink-faint` "›". The whole row links to the match. Below md: hide Score and the chevron, `px-3.5`. |

### 4.2 Review session (`app/review/page.tsx`, `ReviewSession.tsx`, `review.styles.ts`)

**Page.** `px-6 pt-6 pb-[72px]`. Below md, `px-0 pb-24`, with the inner blocks padded `px-4` and the board `px-1.5`.

**Session bar.** This replaces the h1, lede, filter form and counts:
- `flex flex-wrap items-center gap-[18px] mb-7`;
- h1 "Review" at `font-serif text-[26px] font-medium leading-none tracking-[-0.01em]`; this page doesn't use the display size;
- progress: `flex min-w-40 flex-1 items-center gap-3 text-[12.5px] text-ink-muted tabular-nums`, containing "Card 1 of 3", a track (`h-1 flex-1 overflow-hidden rounded-[2px] bg-line`, fill `h-full bg-ink`, width = answered ÷ session total) and "3 new · 0 review";
- filters: `flex items-center gap-2 text-[12.5px] text-ink-muted`, containing a summary ("All tags · Any phase · All types · All severities", hidden below md), a `pill` "Filter" button and a `textLink` "Manage cards".
- The Filter pill toggles the existing filter form (unchanged fields) in a row below the bar, `aria-expanded`. It starts collapsed and is open by default only when the URL has filters but no cards match.

**Layout.** `grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-9 items-start`. Below md, one column with `gap-5`. The board column has no card. The side column is `flex flex-col gap-[18px]`.

**Front.**
- Context: `flex flex-wrap gap-2 text-[12.5px] text-ink-faint`, for example "**5-point match**" (`font-medium text-ink-muted`) · "you 0 – opp 2" · "·" · "you rolled 6-5". For a cube card: "cube action, before your roll".
- Question: `mt-1.5 font-serif text-[30px] font-medium leading-[1.15] tracking-[-0.012em]` (26px below md). The copy is "Your move. *What do you play?*", with the `<em>` in `italic font-normal text-ink-muted`. For a cube card: "Cube action. *What do you do?*"
- Options: `flex flex-col gap-2`. Each one is `flex w-full items-center gap-3.5 rounded-[11px] border border-line bg-surface px-4 py-[13px] text-left shadow-card transition hover:-translate-y-px hover:border-ink-faint`. Key: `kbd` at `h-[22px] w-[22px] rounded-[5px]`. Move: `font-mono text-base font-medium`.
- Hint below: "Press 1–4 to answer." at `text-xs text-ink-faint`.

**Back.** The order is: context plus verdict, summary, options card, note card, grade, links.
- **Verdict:** `mt-2 flex items-baseline gap-3 border-b border-line pb-3.5`.
  - Word: `font-serif text-[28px] font-medium italic leading-none`, `best-ink` or `blunder-ink`. The copy is "**Correct.**" or "**Not quite.**"
  - Sub: `text-[13px] text-ink-muted`, either "22/16 6/1* is the best play." or "Best is Double / Take. You lose 0.183."
- **Summary:** `grid grid-cols-[auto_1fr] gap-x-[18px] gap-y-1.5 text-[13px]`; dt `text-ink-faint`; dd `font-mono text-[13.5px] font-medium` with the equity in a `font-normal text-ink-faint` span, `22/11 −0.168`. No parentheses.
- **Options card:** `card overflow-hidden`.
  - The caption is an overline, "Options · equity loss" (`px-4 pt-3.5 pb-2`). The separate "Option / Loss" header row goes.
  - Cells: `px-4 py-[9px] border-t border-line font-mono text-[13.5px] font-medium`. The loss cell is `text-right tabular-nums text-ink-muted`.
  - Best row: `bg-best-tint` with `shadow-[inset_3px_0_0_var(--color-best)]` on the first cell.
  - Chosen wrong row: `bg-blunder-tint` with a blunder inset bar, and its loss in `blunder-ink`.
  - Row labels: `ml-2.5 font-sans text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-faint`, reading "Best · your answer", "Played" or "Your answer".
- **Cube equities** go **inside the same card**, below the table: `grid grid-cols-3 border-t border-line`; cells `flex flex-col gap-0.5 px-4 py-2.5`, plus `border-l border-line` on cells 2 and 3; label `text-[11.5px] text-ink-faint`; value `font-mono text-[15px] font-medium`. The separate equities card goes.
- **Note card:** `card flex flex-col gap-2 px-4 py-3.5`, holding:
  - the overline "Your note";
  - the body, `font-serif text-base leading-[1.55]`;
  - the foot, `flex flex-wrap items-center justify-between gap-2`: the tag chips (`tagChip`) with a `tagChipAdd` "+ tag" on the left, and a text button "Edit note" or "Write note" on the right (`text-[12.5px] text-ink-muted underline underline-offset-[3px]`).

  When there's no note, the body is `italic text-ink-faint`: "No note yet. What made this a double?" (or "…this the best play?"). Edit mode swaps the body for the existing textarea (`DecisionNote`) plus Save. The separate Tags card goes, and the tags live here (**needs approval**, §6: the view/edit toggle).
- **Grade:** `grid grid-cols-3 gap-2`. Each button is `flex flex-col items-center gap-1 rounded-[11px] border border-line-strong bg-surface px-1.5 py-2.5 hover:bg-sunken`, with the label `text-[13.5px] font-semibold` and the key `font-mono text-[10.5px] font-medium text-ink-faint`. "Good" is primary (`bg-primary text-on-primary border-primary`, key `text-on-primary/70`).
  - After an incorrect answer: one primary button spanning all 3 columns, labelled "Next card", with the key line "Recorded as Again · Enter". The separate "Recorded as Again." text goes.
  - **Below md: `sticky bottom-3 z-10`.** No ancestor of the grade row may have `overflow: hidden/auto`, so check `layout` and `sideColumn`.
- **Links** go *after* the grade: `flex gap-[18px]`, "Open in replay" and "View on Galaxy ↗".
- **The board on the back** shows the **best move's arrows** (`arrow-best`), as in the mockup (**needs approval**, §6; today quiz mode shows no arrows).

### 4.3 Replay (`GameReplay.tsx`, `gameReplay.styles.ts`, `BoardPanel.*`, `DecisionList.*`, `DecisionNote.*`, `DecisionReviewTools.*`)

**Page.** `px-6 pt-7 pb-[72px]`. Below md, `px-0`, with inner blocks `px-4` and the board `mx-1.5`.

**Header.**
- Crumbs: `flex gap-2 text-[13px] text-ink-faint`, with the separator "›" at `opacity-60` and the last crumb in `ink-muted`.
- Head: `mt-2.5 mb-6 flex flex-wrap items-end justify-between gap-4`.
- h1: `font-serif text-[32px] font-medium leading-[1.1] tracking-[-0.015em]` (26px below md), reading "Game 2 *vs* cbj2", with "vs" in `italic font-normal text-ink-muted`.
- Sub: `mt-1.5 text-[13px] text-ink-faint`, "Match 45282503 · replay".
- Right side: `flex flex-wrap items-center gap-[18px]`.
  - Game switcher (segmented): `flex gap-1 rounded-[9px] bg-sunken p-[3px]`. Items are links `rounded-[7px] px-[11px] py-[5px] text-[12.5px] font-medium text-ink-muted`; the current one adds `bg-surface text-ink shadow-[0_1px_2px_var(--shadow-color)]` and `aria-current`. One item per real game.
  - Links "Back to match" and "View on Galaxy ↗".

**Layout.** `grid grid-cols-[minmax(0,1fr)_380px] gap-6 items-start`; below 980px (`max-[980px]:` or `lg:` for the two-column version), one column. The left column is `flex flex-col gap-4`.

**Under the board, in order:**
1. **Stepper:** `flex flex-wrap items-center gap-3`.
   - Prev and Next buttons: `inline-flex h-9 items-center gap-2 rounded-[9px] border border-line-strong bg-surface px-3 text-[13px] font-medium hover:bg-sunken`, with a `kbd` "←" or "→".
   - Between them: "Move **2** of 18 · **2-1** to play" (`text-[13px] text-ink-muted`, bold parts `font-semibold text-ink`). For a cube step: "· cube action".
   - The "Fixed perspective" checkbox moves here, `ml-auto text-[12.5px] text-ink-muted`, hidden below md.
2. **Decision chips:** `grid grid-cols-2 gap-2.5`, `role="tablist"`. This replaces the "Game 2" badge and the two small chips.

```ts
decisionChip: (opts: { tier: SeverityTier; isActive: boolean; isButton: boolean }): string =>
  clsx(
    "flex flex-col gap-1 rounded-[11px] border px-3.5 py-3 text-left",
    opts.isActive
      ? clsx(
          opts.tier === "best" && "border-best/70 bg-best-tint shadow-[inset_3px_0_0_var(--color-best)]",
          opts.tier === "good" && "border-good/70 bg-surface shadow-[inset_3px_0_0_var(--color-good)]",
          opts.tier === "error" && "border-error/70 bg-error-tint shadow-[inset_3px_0_0_var(--color-error)]",
          opts.tier === "blunder" && "border-blunder/70 bg-blunder-tint shadow-[inset_3px_0_0_var(--color-blunder)]"
        )
      : clsx("border-line bg-surface", opts.isButton && "opacity-85 hover:opacity-100")
  ),
decisionLabel: "flex items-center gap-2 text-[10.5px] font-semibold uppercase leading-none tracking-[0.08em] text-ink-faint",
decisionMove: (tier: SeverityTier): string => clsx("font-mono text-[17px] font-medium leading-[1.2]", shared.severityText(tier)),
decisionLoss: "font-mono text-[12.5px] text-ink-muted",
```

   The label reads "Played" plus a `severityChip` of the played tier, or "Best" plus a `severityChip("best")`. Under it come the move, then the loss (`−0.037` for Played, `0.000` for Best).
   - The same component serves /mistakes, the match page and the review back (static variant).
   - On /mistakes and the match page, which have no stepper, put "Game 4" in the context line above the board (§5).
3. **Note card** (merges today's Note card, Add-to-review/Tags card and checkbox): `card flex flex-col gap-2.5 px-[18px] py-4`.
   - Head: `flex items-center justify-between`, with the overline "Your note" and a `buttonCompactPrimary` "Add to review" (or "In review ✓" when it's already a card, as `buttonCompact`).
   - Textarea: `min-h-[84px] w-full resize-y rounded-[9px] border border-line bg-paper px-3 py-2.5 font-serif text-[14.5px] leading-[1.55] text-ink placeholder:italic placeholder:text-ink-faint`. The placeholder is "Why is {best} better here?" when the decision is a mistake, and "Your note on this decision…" otherwise.
   - Foot: `flex flex-wrap items-center justify-between gap-2.5`, with the tags (`tagChip` plus `tagChipAdd`, which reveals the existing `TagEditor` input inline) and a `buttonCompact` "Save note".

**Move list card** (right column): `card sticky top-[76px] flex max-h-[calc(100vh-96px)] flex-col overflow-hidden`. Below 980px it's static with no max height, and below md it goes `rounded-none border-x-0`.
- **Head:** `flex items-center justify-between border-b border-line px-4 pt-3.5 pb-2.5`, with the overline "Moves" and a legend (`flex gap-2.5 text-[11.5px] text-ink-faint`; each item a 7px `rounded-[2px]` square in `bg-error` or `bg-blunder`, `mr-1`).
  - **There's no table header row.** Drop "# ROLL DETAIL".
- **Body:** `overflow-y-auto`.
- **Row** (it can stay a `<tr>` or become a focusable `div role="row"`; it keeps `tabIndex`, Enter/Space and `aria-current`):

```ts
moveRow: (isSelected: boolean): string =>
  clsx(
    "grid cursor-pointer grid-cols-[28px_44px_1fr_auto] items-center gap-2 border-b border-l-[3px] border-b-line py-2 pl-3.5 pr-4",
    shared.focusRingInset,
    isSelected ? "border-l-accent bg-[color-mix(in_srgb,var(--color-accent)_9%,var(--color-surface))]" : "border-l-transparent hover:bg-sunken"
  ),
moveIndex: "text-right font-mono text-xs text-ink-faint",
moveDice: "flex gap-[3px]",                 // mini dice 16px, see below
movePlayed: (tier: SeverityTier | null): string =>
  clsx("font-mono text-[13px] font-medium leading-[1.3]", tier && tier !== "best" ? shared.severityText(tier) : "text-ink"),
moveBestLine: "mt-0.5 block font-mono text-[11.5px] leading-[1.3] text-ink-faint",   // "best <b>13/11 6/5</b>"
moveBestMove: "font-medium text-best-ink",
```

  - **Colour rule** (a change from Phase 1): a move that *was* the best play is plain `ink`, not green. Only Good, Error and Blunder are coloured. The "best …" line and a right-aligned `severityChip` appear only on non-best rows.
  - **Mini dice:** a neutral variant of `Dice.tsx` (`variant="mini"`), 16px, `viewBox 0 0 100 100`, rect `x=6 y=6 w=88 h=88 rx=20`, `fill-surface stroke-ink-muted [stroke-width:7]`, pips `r=10 fill-ink`. They aren't checker-coloured.
  - **Cube square:** `h-[18px] w-[18px] rounded-[4px] font-mono text-[10.5px] font-bold`, using the existing tier logic.

---

## 5. Pages without a mockup (same patterns)

| Page | Apply |
|---|---|
| **Matches** (`app/matches/*`) | Page header as on the dashboard (no date overline); the "Mistake pattern analysis →" link is in the section-head pattern, baseline-aligned with the h1. Shared table (§1.2): Match ID (`tabular-nums text-ink-muted`), Date ("5 Oct"), Opponent (`font-medium`), Rating, Score, Your PR and Opp. PR (2 decimals, right-aligned, `tabular-nums`), and a chevron column. The whole row links to the match. The "Replay" text links go, because the match page has the game switcher. The pager uses `buttonSecondary` and the text "Page 1 of 146" in `text-[13px] text-ink-muted`. Below md: Match ID, Opponent, Your PR and the chevron only. |
| **Analysis** | Shared table with numbers **right-aligned**. Section titles `text-heading`. "Last computed" as "7 Oct 2026, 15:25" in local time. "CHECKER"/"CUBE" through the label map, giving "Checker"/"Cube". |
| **Match page** (`app/matches/[matchId]`) | Header as on the replay: crumbs; h1 "*vs* hamidesmaeilii" (the same italic `vs` style); sub "Match 47816592 · 5 Oct 2026 · 2–5"; on the right, the segmented switcher labelled "Replay" with game 1…N links, plus "View on Galaxy ↗". The three PR cards become **one stat card** (`card grid grid-cols-3`; cells `px-[18px] py-3.5` with `border-l border-line` from the 2nd cell; overline label; value `font-serif text-[30px] font-medium leading-none tabular-nums`; meta `text-xs text-ink-faint` "90 decisions"), so the board starts higher. Section head "Mistakes" (h2) with the Game select on the right; "You: meisam2" goes into the sub line. Then the replay layout (`minmax(0,1fr) 380px`): board, decision chips, note card on the left; the list card on the right. The list rows use the replay row pattern plus a leading checkbox column (`grid-cols-[20px_44px_1fr_auto]`; the index column drops; the loss moves into the `auto` cell, `font-mono text-xs text-ink-muted`). "Select all / Select none" stays in the list head instead of the legend. |
| **Mistakes** | Header (display h1 plus lede). The filter becomes the review session's **summary-plus-Filter-pill** pattern. The result line reads "39,028 checker blunders" (lower-cased labels), with `buttonSecondary` "Add all to review" on the right. Layout as the replay. The left column is **not a card**. Its context line is `flex flex-wrap items-center gap-2 text-[12.5px] text-ink-faint`: `codeChip` BLZ, `severityChip` Blunder, "Loss **0.111**", "Game 4", and the links "View match →" and "View on Galaxy ↗" pushed right. Then the board, decision chips and note card. The list card on the right is in the replay row pattern: the played move plus a best line, and on the right `codeChip` + `severityChip` + loss. |
| **Repeated positions** (list and drilldown) | The filter pattern as on Mistakes. Shared table: Classification (`codeChip`), Severity (`severityChip`), Position ID (`font-mono text-[12.5px] text-ink-muted`), Times faced as `font-serif text-lg font-medium tabular-nums` with a small "×" (`ml-0.5 font-sans text-[11px] text-ink-faint`), and a chevron (the row links; "View →" goes). The drilldown uses the Mistakes layout. |
| **Review cards** | Header with a crumb. The filter pattern. Shared table; Position cell is `font-mono text-[12.5px] text-ink-muted` above a `textLink` to the match; Reps and Lapses right-aligned; State in `text-ink-faint`; Suspend and Delete stay `buttonSmall`/`buttonDanger`. |
| **Status** | Already close. Counts use thousands separators in sans `tabular-nums` (`1,268,047`); versions and the migration name stay mono. Each section card's rows: `flex justify-between border-t border-line py-2.5 text-[13.5px]`. |
| **Galaxy pages** | Shared table, `pill`, buttons and modal patterns only. No layout change. |

---

## 6. What the mockups invented: don't fake data

**A. Display only. It uses existing data, so build it.**
- The date overline on the dashboard (today's date).
- The error/blunder stacked bar (the existing totals).
- The rating's faint decimals and the match-id link.
- "5 Oct" dates and the chevrons.
- Replay: the game switcher (the real game count; the mockup assumed 3), the "Game 2 vs cbj2" title, "Move 2 of 18 · 2-1 to play", the legend, the "best …" lines, and the Played/Best chips with losses.
- Review: the "you rolled 6-5" context, and the verdict sentences "Correct." / "Not quite." with "Best is … You lose …".
- The cube-equities strip.
- The dashboard's "3 new · 0 review" split. The counts already exist for `/review` (`dueNew`/`dueReview`); the dashboard just needs the same query.
- The brand mark.
- **Use the real numbers.** The mockup's 280/155/37/89 and its move severities (for example, row 1 shown as an Error) are illustrative. The real row 1 is Good.

**B. Small new behaviour or logic: needs approval.**
1. **"Most repeated blunders" dashboard panel.** The data exists (the `/repeated-positions` query, severity = blunder, top 4 by times faced), but it's a new dashboard section and a new query. Without approval, Latest matches spans the full width.
2. **"Your PR" label and 2-decimal PR on the dashboard and matches table.** The "Your error" value (5.200) appears to be the same number the match page calls Total PR (5.20 for match 47816592). Have the investigator confirm that it *is* PR before relabelling. The bar's scale (`PR × 5px`, cap 100) is a design choice.
3. **The review progress "Card 1 of 3" and its track.** It needs the session's starting total, kept in client state: the count at load plus the number answered. No new server data.
4. **Best-move arrows on the review back face.** Today quiz mode draws no arrows. The best move's sub-moves are already available, because BoardPanel draws them on the "Best" tab elsewhere.
5. **The note as read-only text with an "Edit note" toggle**, and tags folded into the note card (review back). It's a UI behaviour change; the same data.
6. **The filter collapsed behind a "Filter" pill** (/review, /mistakes, /repeated-positions, /review/cards).
7. **The `+N` stack label changing meaning**, from "this checker stands for N" (today `+{n−4}`) to "N more than shown" (`+{n−5}`, the mockup). The user asked for the mockup's version. This line just records that the meaning changes.

**C. Invented content. Never seed or hard-code it.**
- The tags "opening", "slotting", "hit loose", "back checker".
- The note text "Back checker on 22 is alone…".
- The placeholder "Why is 13/11 6/5 better here?" is fine only as a *template* filled from the real best move (§4.3).
- "Synced 3 days ago · 28 matches" comes from the existing sync state, so no change is needed. It's listed here only so nobody copies the literal.

---

## 7. Also included now (previously deferred)

- **Sticky translucent navbar:** §3, including the dialog and visual-test fixes.
- **Sticky mobile rating row:** §4.2, Grade.
- **Copy polish:**
  - `DecisionCard.tsx:43`: "|error| 0.111" becomes "Loss **0.111**";
  - `app/matches/analysis/page.tsx:155`: `toISOString()` becomes a formatted local date and time;
  - "CHECKER"/"CUBE"/"checker" go through the label maps;
  - the result lines are lower-cased ("39,028 checker blunders");
  - "Last synced" becomes "Synced";
  - review: "Correct."/"Not quite." with their sub-lines, and "Next card · Recorded as Again · Enter".
- **Phase 1 review fixes**, from `reports/2026-10-08-design-review-phase1.md` (d):
  - `--scrim`;
  - `--primary`;
  - the mobile dashboard table;
  - `playedMoveTier(null)`, with the investigator confirming first;
  - the checker-ring tokens;
  - the test that the duplicated dark blocks stay identical.

## 8. How to verify

After each block, regenerate the design screenshots and compare each against its mockup, in both themes at 1440 and 390:
- `replay-checker-error-move2--1440-light--viewport` against `replay.html`;
- `review-card1-front`, `review-card1-back-correct` and `review-card2-back-incorrect` against the three `review-card.html` states;
- `dashboard--1440-light--full` against `dashboard.html`.

I can review those screenshots once they exist.
