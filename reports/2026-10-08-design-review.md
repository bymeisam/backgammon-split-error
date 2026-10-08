# Design review: look and feel (2026-10-08)

The brief: the app "isn't really posh". Find out why, propose 2–3 style directions, recommend one, and specify it so a developer can build it in small steps.

I reviewed screenshots from `design/screenshots/2026-10-08/`, about a quarter of the 114, covering every page at both widths and in both themes. I also read `app/globals.css`, `app/layout.tsx`, every `*.styles.ts`, `lib/styles/shared.styles.ts`, `lib/badges.ts`, `lib/checkerPalette.ts`, `lib/boardGeometry.ts`, `Board.tsx`, `BoardPanel.tsx` and `ReviewSession.tsx`. In the citations below, screenshot names drop the folder, and `…--1440-light` means `…--1440-light--full.png` or `--viewport.png`.

**Recommendation in one line:** adopt **A · Clubroom**. That means warm ivory paper and ink-black type, a Newsreader serif for titles and big numbers, Geist for the interface (actually loaded this time), Geist Mono only for notation and equities, and a walnut-and-bone board. Colour is reserved for Galaxy's severity colours, and those come from one token set.

Mockups (open them in a browser; each has a ◐ theme toggle):
- `design/mockups/directions.html`: the three directions side by side, light and dark
- `design/mockups/dashboard.html`
- `design/mockups/review-card.html`: front, back (correct) and back (incorrect cube card), switched with the buttons at the bottom right
- `design/mockups/replay.html`

---

## 1. Diagnosis: why it doesn't feel posh

The short version: the app is built from Tailwind defaults, and the defaults show. It uses the zinc greys, `rounded-lg border-black/10` on every box, and pure black in dark mode. On top of that, a fallback font is overriding the real one, and there are two competing sets of severity colours. None of this is broken, but nothing in it was chosen on purpose, and that's what reads as "not posh".

### 1.1 Typography

- **The app renders in Arial, not Geist.** `app/globals.css:25` sets `body { font-family: Arial, Helvetica, sans-serif }`. `app/layout.tsx:10-18` loads Geist and puts its variable on `<html>` (`app/layout.styles.ts:13-14`), but nothing on `body` uses `font-sans`, so Arial wins. Every screenshot shows it, for example the "Dashboard" heading in `dashboard--1440-light`. The Geist download is wasted, and Arial at 14px is the single biggest reason the app looks generic.
- **Monospace is overused, so the app reads like a terminal.** `font-mono` appears 25 times in the styles files: dates, scores, match IDs, PR, ratings and counts as well as move notation (`app/home.styles.ts:10`, `:31`; `app/components/match-analysis/DecisionList.styles.ts:29-31`). In `matches-list--1440-light` every column except the opponent is mono. In `nav-menu-open--390-light`, the mono date "5 Oct 2026" wraps onto three lines. Mono should be the signal for "this is a move or an equity", not a default for anything numeric.
- **The hierarchy is flat.** The page title is `text-2xl font-semibold` (`app/components/ui/PageShell.styles.ts:26`), section titles are `text-lg font-semibold` (`app/home.styles.ts:36`), and card labels are `text-xs uppercase` (`app/home.styles.ts:8`). That's one family at three sizes and one weight, so there's no typographic contrast between "where am I", "what's this section" and "what's this number". The big rating `1,853.21` is set in bold mono (`home.styles.ts:10`), which looks like a code sample rather than a headline figure (`dashboard--1440-light`).
- **Every table uses spreadsheet headers.** Header rows are uppercase, tracked and filled in `bg-zinc-100` (`home.styles.ts:27-28`, `DecisionList.styles.ts:24-25`), as in `matches-analysis--1440-light` and `repeated-positions-blunders--1440-dark`.

### 1.2 Colour

- **There's no palette, only zinc and black.** About 430 `dark:` variants across the styles files are hand-paired zinc shades: `zinc-100` ×92, `zinc-400` ×88, `zinc-500` ×61 and so on. There are no semantic tokens; `globals.css` defines only `--background` and `--foreground`, and nothing uses them. The result is cold and neutral, with no character, and every new component has to re-pick its greys.
- **Dark mode is pure black.** `PageShell.styles.ts:12` sets `dark:bg-black`, with `zinc-900` cards on top. That's maximum contrast and glare for long study sessions (`dashboard--1440-dark`, `status--1440-dark`).
- **There are two sets of severity colours.** The badges use Galaxy's hex values (`lib/styles/shared.styles.ts:14-18`). Everything else uses Tailwind's own red, amber and green:
  - the move text in lists (`MoveDelta.styles.ts:18`, `:26`, `:40`);
  - the my-move and best-move chips under the board (`BoardPanel.styles.ts:26-62`);
  - the board arrows (`BoardPanel.tsx:13-15`: `#dc2626`, `#d97706`, `#16a34a`);
  - the review verdict (`review.styles.ts:33-38`).

  So one Blunder shows up in two different reds on the same screen (`mistakes-checker-blunders--1440-light`: the pink `Blunder` chip next to the red `16/6`).
- **Blue and green have no stable meaning.** Blue appears as the due-count badge (`AppNav.styles.ts:53`), the selected-row ring (`DecisionList.styles.ts:53`), the note dot (`:33`), the "New 3" count (`review.styles.ts:19`), the Easy button (`review.styles.ts:68`) and Galaxy's cube square. Green appears as Best, the "Local · write" badge, the "Review 0" count and the **"Good" rating button** (`review.styles.ts:67`). That last one clashes: in Galaxy's vocabulary, and in this app's badges, "Good" is the *slate* severity. In `review-card1-back-correct--390-dark` a green "Good" button sits just below a green "Best" row.

### 1.3 Spacing, hierarchy and density

- **Everything is a bordered box, often box-in-box.** The filter form, the session counts, the board panel, the note, the tags and the options are each a `rounded-lg border bg-white p-4` card. `review-card2-back-incorrect--1440-dark` stacks six of them in the side column. On /mistakes the board panel is a card inside the DecisionCard card (`mistakes-checker-blunders--1440-light`). Uniform 1px borders with no elevation make it look flat and busy at the same time.
- **The page width jumps between pages.** The dashboard, matches and analysis pages use `max-w-4xl` (`PageShell.styles.ts:18`; `app/page.tsx:181`, `app/matches/page.tsx:47`) while the board pages use `max-w-7xl`, and the nav is always `max-w-7xl` (`AppNav.styles.ts:13`). The title's left edge moves from x≈296 (`dashboard--1440-light`) to x≈104 (`mistakes-checker-blunders--1440-light`) when you switch tabs.
- **The decision list clips its own last column.** The fixed `lg:w-[380px]` list (`MistakesSection.styles.ts:43`, `DecisionListWithDetail.styles.ts:17`) cuts off the loss column: "|ERROR" is truncated in `mistakes-checker-blunders--1440-light`, and the values disappear entirely in `match-detail-47816592--1440-light--viewport`.
- **The dashboard is underused.** The "Cards due today" widget is 70% empty space with an underlined text link as its only action (`dashboard--1440-light`). The app's main loop, reviewing due cards, has no primary button anywhere on the dashboard.

### 1.4 Consistency

- Buttons come in four looks: rounded-full outline (Apply, Prev/Next, modals), rounded-lg filled colour (rating), rounded-lg grey (Save), and a black pill (the active nav item). Compare `review-cards--1440-light` with `replay-cube-take-move16--390-light`.
- The filter form and Apply button are copy-pasted identically in `mistakes.styles.ts:11-13`, `review.styles.ts:10-12` and the other filter pages.
- The active nav item is a heavy black filled pill (`AppNav.styles.ts:47`). It's the loudest thing on every page, louder than the content.
- Small copy details:
  - the browser tab is titled "Galaxy Game Review Dumper" (`app/layout.tsx:21`);
  - the analysis subtitle prints a raw ISO timestamp, `2026-10-07T05:25:18.718Z` (`matches-analysis--1440-light`);
  - raw enum values `CHECKER`/`CUBE` and `checker` leak into tables and selects;
  - the DecisionCard header reads "|error| 0.111".

### 1.5 Board presentation

The board is the centre of the app, and right now it looks like a diagram rather than an object.

- **It has no frame.** The margin is drawn in the same cream `#f5ecd9` as the playing surface (`Board.tsx:191`), so the board has no edge. It's a beige rectangle inside a white card (`replay-checker-error-move2--1440-light`).
- **The bar reads as a wide point.** The bar is filled `#c89f6c` (`Board.tsx:198`), the same colour as the light points (`:206`).
- **The checkers are small and overlap.** `R = 14` on a 48-wide point (`lib/boardGeometry.ts:11`, `:16`) is a 28px checker, 58% of the point width, and the stack step of `STACK_GAP = 24` (`:17`) is less than the 28px diameter, so stacks overlap. The board looks sparse and the stacks look thin.
- **The point numbers are tiny.** They use `fontSize={9}` inside a 716-unit viewBox (`Board.tsx:228`; `BOARD_W` from `boardGeometry.ts:48`). That renders at about 10px on the 1440 replay but **about 3.5px at 390** (`mistakes-checker-blunders--390-light--viewport`, `review-card1-front--390-light`), where they're unreadable, and you need them to read the notation.
- **The board ignores dark mode.** It stays bright cream on a black page (`replay-checker-error-move2--1440-dark`). It's the brightest object on the screen and pulls the eye away from the move list.
- **The arrows use Tailwind colours, not severity colours** (see §1.2), and they have no halo, so the red arrow fades where it crosses dark points (`match-detail-47816592--1440-light--viewport`).
- **On 390 the board loses about 30% of its width** to two nested `p-4` cards (`BoardPanel.styles.ts:14-15` inside the DecisionCard) in `mistakes-checker-blunders--390-light--viewport`.
- **At 1440 the board is too tall.** On the match page it fills the 7xl column and runs below the fold (`match-detail-47816592--1440-light--viewport`), so the move chips under it are off-screen.

### 1.6 Narrow screen (390)

- The review back face is about 2,000px tall, and the rating buttons (the one thing you must press) are at the very bottom (`review-card1-back-correct--390-dark--full`).
- The filter forms take about a quarter of the first screen on /review, /mistakes and /repeated-positions at 390 (`mistakes-checker-blunders--390-light--viewport`). For a study session the filter rarely changes.
- The open mobile menu mixes nav items, sync text, Status and a lone "?" circle in one column with uneven indents (`nav-menu-open--390-light--viewport`).
- The tables stay full desktop tables: four columns with wrapped dates and IDs (`nav-menu-open--390-light`, lower half).

### 1.7 Dark mode

- The page is pure black, the cards zinc-900 and the board unchanged (see above).
- The verdict is a large saturated red slab ("Incorrect", `review-card2-back-incorrect--1440-dark`) followed by full-width dark-red and dark-green option rows. It's alarming rather than calm, at exactly the moment you want to reflect.

### 1.8 Accessibility

Contrast ratios below are WCAG 2.x, computed from the hex values.

| Where | Colours | Ratio | Verdict |
|---|---|---|---|
| Best move text, light (`MoveDelta.styles.ts:26`) | green-600 `#16a34a` on white | 3.3:1 | **Fails** AA for 12px text |
| Error move text, light (`MoveDelta.styles.ts:18`) | amber-600 `#d97706` on white | 3.2:1 | **Fails** |
| Blunder move text, light | red-600 `#dc2626` on white | 4.8:1 | Passes |
| "Hard" button (`review.styles.ts:66`) | white on amber-600 | 3.2:1 | **Fails** (14px medium) |
| "Good" button (`review.styles.ts:67`) | white on green-600 | 3.3:1 | **Fails** |
| Option key hint "1–4" (`review.styles.ts:30`) | zinc-400 on white | 2.6:1 | **Fails** |
| Muted text (zinc-500 on the zinc-50 page) | `#71717a` on `#fafafa` | 4.6:1 | Passes, just |
| Severity chips (`shared.styles.ts:14-18`) | near-black on `#F43E5C`, `#FBBD23`, `#36D399`; white on `#65758B` | 5.4 / ≥10 / ≥10 / 4.7 | Pass |
| Galaxy Error `#FBBD23` *as text* on a light page | — | 1.7:1 | Never usable as text in light mode, so separate "ink" tokens are needed (§3.1) |

**Focus states:**
- Every text input uses `outline-none focus:border-black/30` (`DecisionNote.styles.ts:10`, `TagEditor.styles.ts:16`, `MistakesSection.styles.ts:32`, `galaxyMatches.styles.ts:13`, `:19`, `:72`). The only focus cue is a border going from 10% to 30% black, about 2:1 against white, which is below the 3:1 non-text minimum (WCAG 1.4.11).
- No button or link anywhere defines a `focus-visible` style. They fall back to the browser's default ring, which works but doesn't match anything.
- The decision-list rows are clickable `<tr onClick>` with no `tabIndex` or key handler (`DecisionList.tsx:138-142`), so keyboard users can't reach them on /mistakes or the match page. The replay has ←/→, but the lists elsewhere don't.

**Hidden shortcuts:** the review session already supports `1–4` to answer, and `h` / `g` (or Enter) / `e` to rate (`app/review/ReviewSession.tsx:196-204`). The rating keys appear nowhere: not on the buttons, and not in the `?` help (`shortcuts-help-open-replay--1440-dark`). The number hints on the options exist, but at 2.6:1 contrast.

---

## 2. Directions

All three keep Galaxy's severity hues as the *only* saturated colours. The "posh" has to come from type, surface and the board, not from more colour. `design/mockups/directions.html` shows each one in light and dark with the same sample components and the same board.

### A · Clubroom (recommended)

- **Mood:** a quiet club library, paper and ink. Warm, unhurried and grown-up. It feels like a well-made book about backgammon rather than a dashboard.
- **Palette:** ivory paper with ink-black text and a single deep Oxford navy accent (for the due count, focus and the selected row), on warm neutrals.

  | | Light | Dark |
  |---|---|---|
  | Paper | `#F6F3EC` | warm "lamp-lit" charcoal `#141311` |
  | Cards | `#FFFDF8` | `#1C1A17` |
  | Ink | `#1D1B17` | `#EDE8DD` |
  | Accent | `#24426B` | `#A9C1E8` |

  Dark mode is deliberately not black.
- **Type:**
  - **Newsreader** (variable, optical sizes) for page titles, section titles, the review question, big numbers and your notes. Notes set in a serif read like annotations in a book.
  - **Geist** for all interface text.
  - **Geist Mono** only for move notation and equities.
- **Board:** a walnut frame with the point numbers set in the frame, a bone playing surface, mahogany and sand points, a frame-coloured bar and tray, and larger checkers with a subtle turned ring. In dark mode the bone and points dim about 20%, so the board stops glaring.
- **Fit:** the best of the three. It's calm enough for long review sessions, the board keeps its familiar wood character (only refined), and nothing in the palette competes with the severity colours. Effort is **M**.

### B · Quiet Ink

- **Mood:** Swiss and precise, like a premium analytics tool (Linear or Stripe). It looks premium through restraint: hairlines, generous spacing and one typeface family.
- **Palette:** cool neutrals.

  | | Light | Dark |
  |---|---|---|
  | Page | `#F7F7F8` | `#0D0D10` |
  | Cards | `#FFFFFF` | `#16161A` |
  | Ink | `#111114` | `#EDEDF0` |
  | Accent | indigo `#3D4ED8` | `#8C97FF` |
- **Type:** Geist and Geist Mono only, with hierarchy from weight and size.
- **Board:** graphite frame, light grey surface, slate points and monochrome checkers.
- **Fit:** very legible and dense, and the smallest change from today. The risk is that "posh" rests only on spacing, so it can still feel generic, and a grey board loses the game's character. Effort is **S–M**.

### C · Midnight Felt

- **Mood:** casino salon. Dark-first, green baize, brass and oxblood, with a high-contrast display serif. The most luxurious-looking of the three.
- **Palette:** dark is the primary theme.

  | | Dark | Light ("parchment") |
  |---|---|---|
  | Page | `#0E1714` | `#F2EDE0` |
  | Cards | `#13201C` | `#FAF7EE` |
  | Ink | cream `#ECE5D3` | `#18231E` |
  | Accent | brass `#C9A45C` | `#8A6A2B` |
- **Type:** Playfair Display, Inter and JetBrains Mono.
- **Board:** a green felt surface with ivory and oxblood points and a walnut frame with brass numbers.
- **Fit:** the weakest for *this* app.
  - Brass sits next to Error amber, oxblood next to Blunder red, and baize next to Best green, so severity loses its uniqueness.
  - The green best-move arrow nearly disappears on the felt (see the board in `directions.html`).
  - It feels like a game client rather than a study tool, and the light theme is an afterthought.
  - Effort is **L**.

### Pick: A · Clubroom

It answers "not posh" most directly (a real typeface pairing, a warm material palette and a board that looks like an object), and it never makes you wonder whether a colour means severity. B is the fallback if the user wants minimal change. C is better as inspiration for the board frame than as a whole system.

---

## 3. Proposed design system (Clubroom)

### 3.1 Colour tokens: `app/globals.css`

This replaces the whole file. The raw values sit in `:root` with a `prefers-color-scheme` override, matching how the file and Tailwind's `dark:` variant already work, and are exposed to Tailwind through `@theme inline`. This makes `bg-surface`, `text-ink-muted`, `border-line`, `fill-board-frame` and so on available. Because the values switch per theme, **components stop needing `dark:` variants**, which removes most of the ~430 of them over time.

```css
@import "tailwindcss";

:root {
  /* surfaces */
  --paper: #F6F3EC;          /* page */
  --surface: #FFFDF8;        /* cards, inputs */
  --sunken: #EFEBE2;         /* hover rows, segmented-control track, kbd */
  --line: #E4DED1;           /* hairlines */
  --line-strong: #CFC7B6;    /* control borders */
  /* text */
  --ink: #1D1B17;
  --ink-muted: #5F5A50;      /* 6.3:1 on paper */
  --ink-faint: #736D61;      /* 4.6:1 on paper; don't use on --sunken */
  /* accent and focus */
  --accent: #24426B;         /* Oxford navy: due count, selected row, active marker */
  --on-accent: #FFFDF8;
  --focus: #2F5BD3;
  /* Galaxy severity: fills (chips, bars, dots), same in both themes */
  --best: #36D399; --good: #65758B; --error: #FBBD23; --blunder: #F43E5C;
  --cube-default: #2C44FF;
  /* severity as text on light surfaces (all at least 4.8:1 on paper) */
  --best-ink: #0B7A55; --good-ink: #55657A; --error-ink: #8F5F00; --blunder-ink: #C81E40;
  /* severity row tints */
  --best-tint: #E4F5EC; --error-tint: #FBF0D2; --blunder-tint: #FBE5E9;
  /* board */
  --board-frame: #4B3425; --board-bone: #EFE5D0;
  --board-point-dark: #8C5A3C; --board-point-light: #CDB089;
  --board-tray: #3A281C; --board-number: #E6D7BC;
  --checker-mine: #1E2126; --checker-mine-rim: #000000;
  --checker-opp: #F7F2E7;  --checker-opp-rim: #7E725E;
  --arrow-best: #12855E; --arrow-error: #A86F00; --arrow-blunder: #D3203F; /* at least 3:1 on bone */
  /* elevation */
  --shadow-color: rgb(60 45 25 / 0.07);
  --board-shadow: rgb(60 35 15 / 0.28);
  --mode-ok: #0B7A55;        /* "Local · write" dot */
  --mode-warn: #8F5F00;      /* "Oracle · write" */
}

@media (prefers-color-scheme: dark) {
  :root {
    --paper: #141311; --surface: #1C1A17; --sunken: #23211D;
    --line: #2E2B26; --line-strong: #433E36;
    --ink: #EDE8DD; --ink-muted: #B3AC9E; --ink-faint: #8E877A;
    --accent: #A9C1E8; --on-accent: #141311; --focus: #8FB0FF;
    --best-ink: #4ADE9F; --good-ink: #9AA8BA; --error-ink: #FBBD23; --blunder-ink: #FF6B82;
    --best-tint: #12291F; --error-tint: #2B230F; --blunder-tint: #2E1419;
    --board-frame: #2A1F17; --board-bone: #C9BC9F;
    --board-point-dark: #6B442E; --board-point-light: #A68B65;
    --board-tray: #1E1610; --board-number: #A8987C;
    --checker-mine-rim: #5E584F;
    --shadow-color: rgb(0 0 0 / 0.45);
    --board-shadow: rgb(0 0 0 / 0.6);
    --mode-ok: #4ADE9F; --mode-warn: #FBBD23;
  }
}

@theme inline {
  --color-paper: var(--paper);
  --color-surface: var(--surface);
  --color-sunken: var(--sunken);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-ink: var(--ink);
  --color-ink-muted: var(--ink-muted);
  --color-ink-faint: var(--ink-faint);
  --color-accent: var(--accent);
  --color-on-accent: var(--on-accent);
  --color-focus: var(--focus);
  --color-best: var(--best);
  --color-good: var(--good);
  --color-error: var(--error);
  --color-blunder: var(--blunder);
  --color-cube-default: var(--cube-default);
  --color-best-ink: var(--best-ink);
  --color-good-ink: var(--good-ink);
  --color-error-ink: var(--error-ink);
  --color-blunder-ink: var(--blunder-ink);
  --color-best-tint: var(--best-tint);
  --color-error-tint: var(--error-tint);
  --color-blunder-tint: var(--blunder-tint);
  --color-board-frame: var(--board-frame);
  --color-board-bone: var(--board-bone);
  --color-board-point-dark: var(--board-point-dark);
  --color-board-point-light: var(--board-point-light);
  --color-board-tray: var(--board-tray);
  --color-board-number: var(--board-number);
  --color-checker-mine: var(--checker-mine);
  --color-checker-mine-rim: var(--checker-mine-rim);
  --color-checker-opp: var(--checker-opp);
  --color-checker-opp-rim: var(--checker-opp-rim);
  --color-arrow-best: var(--arrow-best);
  --color-arrow-error: var(--arrow-error);
  --color-arrow-blunder: var(--arrow-blunder);
  --color-mode-ok: var(--mode-ok);
  --color-mode-warn: var(--mode-warn);

  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-newsreader), ui-serif, Georgia, serif;
  --font-mono: var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, monospace;

  --shadow-card: 0 1px 2px var(--shadow-color), 0 6px 20px -12px var(--shadow-color);
  --shadow-raised: 0 12px 32px -12px var(--shadow-color), 0 2px 6px var(--shadow-color);
  --drop-shadow-board: 0 14px 22px var(--board-shadow);
}

@theme {
  /* type scale (see 3.2) */
  --text-overline: 0.6875rem;
  --text-overline--line-height: 1rem;
  --text-overline--letter-spacing: 0.09em;
  --text-overline--font-weight: 600;
  --text-display: 2.375rem;
  --text-display--line-height: 1.08;
  --text-display--letter-spacing: -0.018em;
  --text-title: 1.75rem;
  --text-title--line-height: 1.12;
  --text-title--letter-spacing: -0.012em;
  --text-heading: 1.375rem;
  --text-heading--line-height: 1.2;
  --text-figure: 3.25rem;
  --text-figure--line-height: 1;
  --text-figure--letter-spacing: -0.02em;
  /* radii */
  --radius-chip: 0.3125rem;   /* 5px  severity and classification chips */
  --radius-control: 0.5625rem;/* 9px  buttons, inputs, selects */
  --radius-card: 0.875rem;    /* 14px cards, list panels */
}

body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-sans);   /* fixes the Arial leftover */
}

::selection { background: color-mix(in srgb, var(--accent) 22%, transparent); }
```

Notes:
- **Severity rule.** The fills (`bg-best`, `bg-good`, `bg-error`, `bg-blunder`) are Galaxy's exact hues, so chips look identical to Galaxy. Any time severity is *text* (move notation, losses, the verdict), use the `*-ink` token. Any time it's a *row background*, use the `*-tint` token. Arrows use `arrow-*`.
- **The cube square** keeps Galaxy's `#2C44FF` for the non-error case (`cube-default`).
- **The "Good" severity** has no tint on purpose. Good rows stay neutral, which matches how the lists already treat it.

### 3.2 Type

| Role | Font | Token / classes | Size / line height |
|---|---|---|---|
| Page title | Newsreader 500 | `font-serif text-display` | 38 / 41 (32 at <md) |
| Card-level title, review question | Newsreader 500 | `font-serif text-title` | 28 / 31 |
| Section title | Newsreader 500 | `font-serif text-heading` | 22 / 26 |
| Big figure (rating, due count, PR) | Newsreader 500, `tabular-nums lining-nums` | `font-serif text-figure` | 52 / 52 |
| Body, controls | Geist 400/500 | `text-sm` | 14 / 20 |
| Table body | Geist 400, `tabular-nums` for numbers | `text-[13.5px]` or `text-sm` | — |
| Overline (card and column labels) | Geist 600, uppercase | `text-overline uppercase text-ink-faint` | 11 / 16, +0.09em |
| Meta, help text | Geist 400 | `text-xs text-ink-faint` | 12 / 16 |
| Move notation, equities, position IDs, kbd | Geist Mono 500 | `font-mono` | 13–17 |
| Your notes | Newsreader 400 | `font-serif text-base` | 16 / 25 |

Loading, in `app/layout.tsx`: add `Newsreader` from `next/font/google` next to the existing Geist imports, with `variable: "--font-newsreader"`, `subsets: ["latin"]`, `axes: ["opsz"]` (documented in `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`, "axes") and `style: ["normal", "italic"]`. Then pass its `.variable` into `style.html(...)` alongside the other two. Newsreader is in Next's Google font data (`node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`).

Rules:
- Mono is **only** for notation, equities and IDs. Dates, scores, ratings and counts are sans with `tabular-nums`.
- Dates in tables become "5 Oct", with the year only when it isn't the current year.

### 3.3 Spacing, radii, shadows

- **Spacing:** keep Tailwind's 4px scale. Page rhythm:
  - page `px-6 pt-10 pb-16`;
  - header to content `gap-9` (36px);
  - between cards `gap-4`/`gap-5`;
  - card padding `p-5` (`p-4` for list panels);
  - table cells `px-4 py-2.5` (dense lists `py-2`).
- **One page width:** every page uses the same outer `max-w-[1240px]` as the nav. Narrow pages (status) keep a narrower *inner* column but stay left-aligned to the same edge, so the left edge never jumps.
- **Radii:** chips 5px, controls 9px, cards 14px, pills (tags, filter chips) `rounded-full`. No more mixing `rounded-full` buttons with `rounded-lg` buttons.
- **Shadows:**
  - `shadow-card` on cards: a hairline plus a soft drop, warm-tinted, nearly invisible in light mode and darker in dark mode;
  - `shadow-raised` for modals and the nav dropdown;
  - `drop-shadow-board` on the board SVG.
- **Borders:** hairlines only (`border-line`), not one on every box. The filter bar and the session bar lose their boxes entirely (see 3.4).

### 3.4 Components (`.styles.ts` patterns)

All of these follow `.claude/skills/styling-conventions`: one `style` object per file, camelCase purpose keys, `clsx` for conditionals, explicit types on functions, and cross-cutting values only in `lib/styles/shared.styles.ts`. None of them needs a `dark:` variant.

#### Shared: `lib/styles/shared.styles.ts`

These values are genuinely duplicated across unrelated pages today: buttons, cards, the filter bar, tables and severity.

```ts
import clsx from "clsx";
import type { SeverityTier } from "@/lib/badges";

// Focus ring for every interactive element (buttons, links, rows, inputs).
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

export const style = {
  focusRing,

  // --- surfaces ---
  card: "rounded-card border border-line bg-surface shadow-card",
  overline: "text-overline uppercase text-ink-faint",

  // --- buttons ---
  buttonPrimary: clsx(
    "inline-flex h-9 items-center gap-2 rounded-control bg-ink px-4 text-sm font-medium text-paper",
    "transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-40",
    focusRing
  ),
  buttonSecondary: clsx(
    "inline-flex h-9 items-center gap-2 rounded-control border border-line-strong bg-surface px-4 text-sm font-medium text-ink",
    "transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-40",
    focusRing
  ),
  buttonDanger: clsx(
    "inline-flex h-8 items-center rounded-control border border-line-strong px-3 text-xs font-medium text-blunder-ink",
    "hover:border-blunder hover:bg-blunder-tint",
    focusRing
  ),
  textLink: clsx(
    "font-medium text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-current",
    focusRing
  ),
  kbd: "rounded border border-b-2 border-line-strong bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-ink-muted",

  // --- form controls ---
  input: clsx(
    "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint",
    "focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-focus outline-none"
  ),
  // Filter bar: no box, a row of labelled controls (shared by /mistakes, /repeated-positions, /review, /review/cards).
  filterBar: "flex flex-wrap items-end gap-x-4 gap-y-3",
  filterField: "flex flex-col gap-1.5 text-xs font-medium text-ink-faint",
  filterSelect: clsx(
    "h-9 rounded-control border border-line-strong bg-surface pl-3 pr-8 text-sm text-ink",
    focusRing
  ),

  // --- tables (dashboard, /matches, /matches/analysis, /repeated-positions, /review/cards) ---
  tableWrapper: "overflow-x-auto rounded-card border border-line bg-surface shadow-card",
  table: "w-full border-collapse text-left text-sm",
  tableHeadCell: "border-b border-line px-4 pb-2.5 pt-3.5 text-overline uppercase text-ink-faint",
  tableHeadCellNumeric: "border-b border-line px-4 pb-2.5 pt-3.5 text-right text-overline uppercase text-ink-faint",
  tableRow: "border-b border-line last:border-b-0 transition-colors hover:bg-sunken",
  tableCell: "px-4 py-2.5 text-ink",
  tableCellMuted: "px-4 py-2.5 text-ink-muted tabular-nums",
  tableCellNumeric: "px-4 py-2.5 text-right tabular-nums text-ink",

  // --- severity (one source; replaces severityBest/Good/Error/Blunder and the Tailwind red/amber/green copies) ---
  severityChip: (tier: SeverityTier): string =>
    clsx(
      "inline-flex items-center rounded-chip px-1.5 py-1 text-[10.5px] font-semibold leading-none",
      tier === "best" && "bg-best text-[#062116]",
      tier === "good" && "bg-good text-white",
      tier === "error" && "bg-error text-[#231A02]",
      tier === "blunder" && "bg-blunder text-[#1A0A0E]"
    ),
  severityText: (tier: SeverityTier): string =>
    clsx(
      tier === "best" && "text-best-ink",
      tier === "good" && "text-good-ink",
      tier === "error" && "text-error-ink",
      tier === "blunder" && "text-blunder-ink"
    ),
  cubeSquareDefault: "border-cube-default bg-cube-default text-white",

  // --- modal (existing keys, retokenised) ---
  modalOverlay: "fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6 backdrop-blur-[2px]",
  modalPanel: "flex w-full max-w-lg flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-raised",
  modalHeading: "font-serif text-heading text-ink",
  modalText: "text-sm text-ink-muted",
  modalError: "text-sm text-blunder-ink",
  modalButtons: "flex justify-end gap-2",
} as const;
```

`lib/badges.ts` keeps its config maps. `severityBadges[tier].color` becomes the matching `severityChip` classes. The hex strings stay out of the components.

#### Navbar: `app/components/ui/AppNav.styles.ts`

```ts
link: (active: boolean): string =>
  clsx(
    "inline-flex h-14 items-center gap-1.5 border-b-2 text-[13.5px] font-medium transition-colors",
    shared.focusRing,
    active ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"
  ),
bar: "sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur",
inner: "mx-auto flex h-14 w-full max-w-[1240px] items-center gap-8 px-6",
brand: "flex items-center gap-2.5 font-serif text-xl font-medium tracking-tight text-ink",
dueBadge: "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-on-accent",
// A dot plus text, not a filled pill. Amber stays reserved for "writes go to Oracle".
modeBadge: (label: RuntimeModeLabel): string =>
  clsx(
    "inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted before:h-1.5 before:w-1.5 before:rounded-full",
    label.startsWith("Oracle") || label.startsWith("Writes: Oracle")
      ? "text-mode-warn before:bg-mode-warn"
      : label === "Read-only" ? "before:bg-ink-faint" : "before:bg-mode-ok"
  ),
syncBox: "flex items-center gap-3 text-xs text-ink-faint",
```

On mobile the menu becomes a full-width sheet:
- the nav links as 44px rows;
- a divider, then one "Synced 3 days ago · 28 matches · Sync" row;
- a footer row with Status and `?`, and the theme mode.

#### Cards and widgets: `app/home.styles.ts`

```ts
widget: clsx(shared.card, "flex flex-col gap-3 p-5"),
widgetTitle: shared.overline,
bigNumber: "font-serif text-figure font-medium tabular-nums lining-nums text-ink",
// The due-cards widget gets a real primary action:
reviewButton: shared.buttonPrimary,
```

#### Board frame: `app/components/match-analysis/BoardPanel.styles.ts`

This covers `Board.tsx`. The board stops sitting in a card; its own frame is the container.

```ts
panel: "flex flex-col gap-4",                       // was a bordered card
boardSvg: "w-full drop-shadow-board",
boardFrame: "fill-board-frame",
boardSurface: "fill-board-bone",
boardTray: "fill-board-tray",
point: (isDark: boolean): string => (isDark ? "fill-board-point-dark" : "fill-board-point-light"),
pointNumber: "fill-board-number text-[13px] font-medium",   // in the frame, not on the bone
checker: (side: "mine" | "opponent"): string =>
  side === "mine" ? "fill-checker-mine stroke-checker-mine-rim" : "fill-checker-opp stroke-checker-opp-rim",
arrow: (tier: "best" | "error" | "blunder"): string =>
  clsx(
    tier === "best" && "text-arrow-best",
    tier === "error" && "text-arrow-error",
    tier === "blunder" && "text-arrow-blunder"
  ), // the SVG uses stroke="currentColor"/fill="currentColor", plus a 7px fill-board-bone halo underneath
// The Played / Best toggle under the board (replaces myMoveBadge, bestMoveButton and the *Static variants).
decisionChip: (opts: { tier: "best" | "error" | "blunder"; isActive: boolean; isButton: boolean }): string =>
  clsx(
    "flex flex-col gap-1 rounded-control border px-3.5 py-3 text-left",
    opts.isButton && shared.focusRing,
    opts.isActive
      ? clsx(
          opts.tier === "best" && "border-best/60 bg-best-tint shadow-[inset_3px_0_0_var(--color-best)]",
          opts.tier === "error" && "border-error/60 bg-error-tint shadow-[inset_3px_0_0_var(--color-error)]",
          opts.tier === "blunder" && "border-blunder/60 bg-blunder-tint shadow-[inset_3px_0_0_var(--color-blunder)]"
        )
      : "border-line bg-surface opacity-85 hover:opacity-100"
  ),
decisionMove: (tier: "best" | "error" | "blunder"): string => clsx("font-mono text-base font-medium", shared.severityText(tier)),
```

Board geometry and colour (`lib/boardGeometry.ts`, `Board.tsx`, `lib/checkerPalette.ts`):
- **Frame:** draw the outer `MARGIN` as a frame rect (`fill-board-frame`), the two playing halves as `fill-board-bone`, and the bar and tray in frame colour. Move the point numbers into the frame (raise `MARGIN` to about 20 for that) at 13 units.
- **Checkers:** `R` 14 → **18** and `STACK_GAP` 24 → **36**, so stacks don't overlap. Five checkers × 36 = 180 still fits `ROW_H` 185. Add an inner ring (`r = R − 6`, 12–16% white or black stroke) for a turned-checker look.
- **Palette:** `checkerPalette.ts` keeps the `mine`/`opponent` split but switches to the token values, so the dice still match the checkers.
- **Arrows:** take the severity from the tokens via `style.arrow(tier)` (this replaces `BoardPanel.tsx:13-15`), with a halo.
- **Placement unchanged:** the decision-maker stays at the bottom and the cube stays in the left gutter.

#### Decision list: `app/components/match-analysis/DecisionList.styles.ts`

```ts
row: (isSelected: boolean): string =>
  clsx(
    "cursor-pointer border-b border-l-[3px] border-b-line last:border-b-0",
    shared.focusRing,
    isSelected ? "border-l-accent bg-accent/[0.07]" : "border-l-transparent hover:bg-sunken"
  ),
indexCell: "px-3 py-2 text-right font-mono text-xs text-ink-faint",
detailCell: "px-3 py-2 font-mono text-[13px]",
bestLine: "mt-0.5 block font-mono text-[11.5px] text-ink-faint",  // "best 13/11 6/5" under a mistake
lossCell: "whitespace-nowrap px-3 py-2 text-right font-mono text-xs tabular-nums text-ink-muted",
noteDot: "mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle",
```

Also make the list panel `lg:w-[400px]` with `min-w-0` on the detail cell, so the loss column can never be clipped. Make each row focusable: give the `<tr>` `tabIndex={0}` plus an Enter/Space handler, or put a button in the move cell.

#### Review session: `app/review/review.styles.ts`

```ts
sessionBar: "flex flex-wrap items-center gap-x-5 gap-y-2",            // replaces the counts box and the filter box
progressTrack: "h-1 flex-1 overflow-hidden rounded-full bg-line",
progressFill: "h-full rounded-full bg-ink transition-[width]",
question: "font-serif text-title text-ink",
optionButton: clsx(
  "flex w-full items-center gap-3.5 rounded-control border border-line bg-surface px-4 py-3 text-left shadow-card",
  "transition hover:-translate-y-px hover:border-ink-faint", shared.focusRing
),
optionKeyHint: shared.kbd,                                            // was zinc-400 at 2.6:1
verdict: (correct: boolean): string =>
  clsx("font-serif text-title italic", correct ? "text-best-ink" : "text-blunder-ink"), // a word, not a slab
optionRow: (opts: { isBest: boolean; isChosen: boolean; correct: boolean }): string =>
  clsx(
    "border-t border-line",
    opts.isBest && "bg-best-tint shadow-[inset_3px_0_0_var(--color-best)]",
    opts.isChosen && !opts.isBest && !opts.correct && "bg-blunder-tint shadow-[inset_3px_0_0_var(--color-blunder)]"
  ),
// Neutral grading: the label and key carry the meaning, not a colour ("Good" is not green here).
ratingButton: (kind: "hard" | "good" | "easy" | "next"): string =>
  kind === "good" || kind === "next" ? clsx(shared.buttonPrimary, "h-auto flex-col py-2.5") : clsx(shared.buttonSecondary, "h-auto flex-col py-2.5"),
ratingKey: "font-mono text-[10.5px] opacity-70",                      // shows H, G · Enter, E
noteBody: "font-serif text-base leading-relaxed text-ink",
```

At <lg, the rating row becomes `sticky bottom-3` so it's always within reach (fix 1.6).

---

## 4. Accessibility targets (the recommended system)

| Pair | Ratio |
|---|---|
| `ink` on `paper` / `surface` | 15.5 / 17 |
| `ink-muted` on `paper` | 6.3 |
| `ink-faint` on `paper` / `surface` | 4.6 / 5.0 (not on `sunken`, 4.3) |
| dark `ink-faint` `#8E877A` on dark `surface` | 4.8 |
| `best-ink` / `good-ink` / `error-ink` / `blunder-ink` on `paper` | 4.8 / 5.4 / 5.0 / 5.1 |
| dark `blunder-ink` `#FF6B82` on dark `paper` | 6.8 |
| Severity chips (dark text on Best/Error/Blunder, white on Good) | ≥ 5.4 / ≥ 10 / 5.4 / 4.7 |
| `focus` `#2F5BD3` against `paper` (non-text, needs 3:1) | 5.3 |
| Board arrows on bone (non-text): best / error / blunder | 3.7 / 3.4 / 4.2 |
| Accent due badge (`on-accent` on `accent`) | ≥ 9 |

Focus:
- one ring everywhere: `shared.focusRing` (2px `focus` colour, 2px offset in `paper`);
- inputs swap their border for the ring;
- clickable rows get `tabIndex` and the ring;
- the `?` help gets a "Review" group listing `1–4`, `H`/`G`/`E`, and `Enter`.

---

## 5. Prioritised fixes

Each item is sized to become a spec of its own. S = under an hour, M = half a day, L = a day or more.

### Quick wins

1. **Fix the Arial leftover and add Newsreader (S).** Files: `app/globals.css` (the `body` rule), `app/layout.tsx`, `app/layout.styles.ts`. The whole app switches to Geist immediately, and the serif becomes available. It also fixes the browser tab title, "Galaxy Game Review Dumper" (`layout.tsx:21`), which should be "Game Review".
2. **Add the token layer, with no visual migration yet (S).** File: `app/globals.css` (§3.1). Nothing changes on screen until components use the tokens, but every later item depends on it. The `dark:bg-black` page background (`PageShell.styles.ts:12`) becomes `bg-paper` in the same change, so dark mode is warm charcoal at once.
3. **One severity colour source (S–M).** Files:
   - `lib/styles/shared.styles.ts` (`severityChip`, `severityText`);
   - `lib/badges.ts`;
   - `MoveDelta.styles.ts`;
   - `BoardPanel.styles.ts` (the my-move and best chips);
   - `BoardPanel.tsx:13-15` (arrows);
   - `review.styles.ts` (verdict, option rows).

   This fixes the double reds and the failing 3.2–3.3:1 move text, and makes Blunder look the same everywhere.
4. **Focus ring and keyboard rows (S).** Files: `shared.styles.ts` (`focusRing`, `input`), the six input styles listed in §1.8, `DecisionList.styles.ts` and `DecisionList.tsx` (`tabIndex` and a key handler on rows). This fixes the WCAG 1.4.11 failure and the mouse-only lists.
5. **Neutral rating buttons with their shortcuts shown, plus the Review group in `?` help (S).** Files: `review.styles.ts` (`ratingButton`, `optionKeyHint`), `ReviewSession.tsx` (render the key labels), and the `ShortcutsHelp` content in `app/components/ui/ShortcutsHelp.tsx`. This ends the green "Good" versus the slate Good clash, fixes the 3.2–3.3:1 white-on-colour buttons and the 2.6:1 key hints, and surfaces shortcuts that already exist.
6. **Unclip the decision list (S).** Files: `MistakesSection.styles.ts:43`, `DecisionListWithDetail.styles.ts:17`, `DecisionList.styles.ts`. The loss column becomes visible on /mistakes and the match page.
7. **One page width (S).** File: `PageShell.styles.ts` (the outer container is always 1240px; `narrow`/`medium` only cap an inner column that stays left-aligned). The title's left edge stops jumping between tabs.
8. **Copy polish (S).** Format the analysis "Last computed" date, title-case `CHECKER`/`CUBE`/`checker` through the existing label maps, and change "|error| 0.111" to "Loss 0.111". These are in the page files for `/matches/analysis`, `/mistakes` and DecisionCard.

### Larger changes

9. **Board restyle (M).** Files: `Board.tsx`, `BoardPanel.styles.ts`, `lib/boardGeometry.ts` (`MARGIN`, `R`, `STACK_GAP`), `lib/checkerPalette.ts`, `Dice.tsx`. This covers the walnut frame, numbers in the frame at a readable size, a frame-coloured bar, larger non-overlapping checkers, token fills (so dark mode dims the board), arrows with a halo, and removing the card around the board. It fixes §1.5. Check `Dice.test.ts` and any geometry tests after the `R`/`STACK_GAP` change.
10. **Navbar restyle (M).** Files: `AppNav.styles.ts`, `NavLinks.tsx`, `SyncControl.tsx`. Changes:
    - a serif wordmark;
    - an underline active state instead of the black pill;
    - the mode as a dot plus text;
    - an accent due badge;
    - a sticky, translucent bar;
    - a cleaner mobile sheet.
11. **Shared tables, cards, buttons and filter bar (M).** Files: `shared.styles.ts` plus each page's styles file (`home`, `matches`, `matchesAnalysis`, `repeatedPositions`, `reviewCards`, `mistakes`, `review`, `status`), one page per spec. It removes the copy-pasted form, Apply and table strings and drops their `dark:` variants. Do the dashboard first: it gets the "Start review" primary button and the serif figures.
12. **Calm review session (M).** Files: `review.styles.ts`, `ReviewSession.tsx`, `app/review/page.tsx`:
    - collapse the filter form into a one-line summary with a "Filter" button;
    - replace the counts box with a progress line;
    - show the verdict as a serif word instead of a slab;
    - set notes in the serif;
    - make the rating row sticky on mobile.

    See `design/mockups/review-card.html`.
13. **Replay layout (M).** Files: `gameReplay.styles.ts`, `GameReplay.tsx`, `DecisionList.styles.ts`. It gets a game switcher, a step bar with ←/→ hints, Played/Best decision chips with their losses, a move list showing "best …" under each mistake plus a severity chip, and a sticky list on wide screens. See `design/mockups/replay.html`.
14. **Narrow-screen pass (M).** Files: page styles for `/matches` and the dashboard (card-style rows or fewer columns at <sm, dates without the year), the board pages (board edge-to-edge at <sm), and the filter bars (behind a disclosure at <sm).
15. **Retire `dark:` variants (L, gradual).** As each styles file is touched for another reason, swap its zinc/black pairs for tokens, per the convention's "adopted gradually" rule. There's no big-bang rewrite.

---

## 6. Mockups

| File | What it shows |
|---|---|
| `design/mockups/directions.html` | A, B and C side by side. Each column has a light and a dark panel with swatches, type, nav, buttons, the four severity chips, two move rows and the same board (match 45282503, game 2, move 2). |
| `design/mockups/dashboard.html` | Clubroom dashboard: due cards with a primary action, last-7-days mistakes with an error/blunder bar, rating as a serif figure, latest matches (PR to two decimals, with a small bar), and a suggested "Most repeated blunders" panel using the real top positions from /repeated-positions. Responsive down to 390. |
| `design/mockups/review-card.html` | Front (card 1: 6-5 to play, options 22/11, 22/17 7/1*, 22/16 6/1*, 7/1* 6/1), back correct (best-move arrows, options with losses, a note in the serif, neutral Hard/Good/Easy with their real keys) and back incorrect (card 2's cube action, all five options, cube equities). |
| `design/mockups/replay.html` | Game 2 vs cbj2, move 2 (2-1, played 13/10 as an Error, best 13/11 6/5): framed board with the error arrow, step bar, Played/Best chips, note and tags, and an 18-row move list with "best …" lines and severity chips. |

All the mockups use inline CSS and JS and no external scripts. Fonts come from Google Fonts links with system fallbacks; the real app would load them with `next/font`. The theme follows `prefers-color-scheme`, and the ◐ button overrides it.

---

## 7. Open questions

- **I couldn't render the mockups myself.** The designer rules forbid running a browser or a server, so I've checked the HTML by reading it, not by eye. Someone should open each file once (both themes, plus a narrow window) before it goes to the user.
- **Scope of "posh".** Does the user want the serif? It's the single strongest lever in Clubroom. If they'd rather stay sans-only, direction B with Clubroom's warm palette and board is a valid hybrid.
- **The board's wood look.** Keep the familiar wood palette (refined, as proposed), or go further, toward Galaxy's own board look, for recognition? This is a user decision.
- **Content additions in the mockups** are suggestions, not facts from the app: the "Most repeated blunders" dashboard panel, PR shown to two decimals, the game switcher in the replay header (I assumed three games for match 45282503; I didn't check the real count), and the example tags and note text.
- **The cube square's Galaxy blue `#2C44FF`** is kept. It's the only remaining blue besides the accent. If the user would rather the accent not be blue-ish at all, a deep bottle-green accent would clash with Best, so I'd keep navy.
