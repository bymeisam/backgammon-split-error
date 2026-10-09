# Design system

The one reference for building UI here. It describes the system **as it is
in the code**. The reports it grew out of (`reports/2026-10-08-design-review.md`,
`reports/2026-10-08-design-fidelity-spec.md`, `reports/2026-10-09-design-review-phase2.md`,
`-phase3.md`, `-phase3b.md`) are history; where they and this doc differ, the
code and this doc win.

Read this, and the `styling-conventions` skill
(`.claude/skills/styling-conventions/SKILL.md`), before any UI work. Two
automatic checks back it up: `lib/styleGuard.test.ts` (tokens only, no
"Galaxy" in general UI) and `lib/themes.test.ts` (every theme complete).

## 1. Principles

- **A calm study tool.** People spend long sessions here reviewing their own
  mistakes. Quiet surfaces, hairlines instead of boxes, one accent. Nothing
  competes with the board and the numbers.
- **Colour means severity.** The four severity colours (Best, Good, Error,
  Blunder) are the only loud colours. The accent marks the one thing that's
  "yours right now" (the selected row, the due count). Nothing is coloured
  for decoration.
- **Boards and numbers first.** Positions must be readable and figures
  exact. A prettier board that's harder to read is worse.
- **Real data only.** Never hard-code example content (tags, notes, counts)
  from a mockup.

## 2. Tokens

Every colour, font and themed value is a CSS variable set by the active
theme (`app/themes/<id>.css`) and mapped to a Tailwind name in
`app/globals.css` (`@theme inline`). Use the Tailwind name in a styles file:
`bg-surface`, `text-ink-muted`, `border-line`, `fill-board-frame`,
`stroke-checker-mine-ring`, `font-serif`, `font-display`, `font-emphasis`,
`rounded-card`, `shadow-card`. Opacity modifiers work on colour tokens
(`border-blunder/40`, `hover:bg-primary/86`).

**Per theme** means the value is set by each theme file. **Per mode** means
it also changes between light and dark. Because the tokens switch, a
component needs no `dark:` variant for colour.

### Surfaces (per theme, per mode)

| Token | Tailwind | Use |
|---|---|---|
| `--paper` | `bg-paper` | The page. |
| `--surface` | `bg-surface` | Cards, inputs, tables, the menu sheet. |
| `--sunken` | `bg-sunken` | Hover rows, kbd, segmented tracks. |
| `--line` | `border-line` | Hairlines. |
| `--line-strong` | `border-line-strong` | Control borders (buttons, selects, inputs). |
| `--nav-bg` | `bg-nav-bg` | The translucent navbar. |

### Ink (per theme, per mode)

| Token | Tailwind | Use |
|---|---|---|
| `--ink` | `text-ink` | Body text, titles, figures. |
| `--ink-muted` | `text-ink-muted` | Secondary text, subtitles, table cells that aren't the point. |
| `--ink-faint` | `text-ink-faint` | Meta, overlines, column headers. **Not on `--sunken`** (under 4.5:1 there). |

### Accent and focus (per theme, per mode)

| Token | Tailwind | Use |
|---|---|---|
| `--accent` / `--on-accent` | `bg-accent`, `text-on-accent`, `border-l-accent` | The selected row's bar and wash, the due-count badge, the note dot. |
| `--focus` | `outline-focus` | The keyboard focus ring (global, see §8). |
| `--primary` / `--on-primary` | `bg-primary`, `text-on-primary` | Primary buttons. Clubroom: ink on paper. |

### Severity (per theme; fills the same in both modes)

| Token | Tailwind | Use |
|---|---|---|
| `--best` `--good` `--error` `--blunder` | `bg-best` … | Chip fills, in Galaxy's hues (#36D399, #65758B, #FBBD23, #F43E5C) in every theme. |
| `--on-best` … `--on-blunder` | `text-on-best` … | Text on a fill (dark on green, amber and red; white on slate). |
| `--best-ink` … `--blunder-ink` | `text-best-ink` … | Severity **as text** (moves, losses, the verdict). Per mode. Galaxy's amber is 1.7:1 as text, so text always uses the ink shade. |
| `--best-tint` `--error-tint` `--blunder-tint` | `bg-error-tint` … | Row and chip washes. Good has no tint on purpose. Per mode. |

Use them only through the severity helpers (§4).

### Cube square (per theme)

`--cube-default` / `--on-cube-default` (`shared.cubeSquareDefault`): Galaxy's
blue square for a cube row in the lists that isn't an Error or Blunder (those
take the severity fill).

### Board (per theme, per mode)

| Token | Use |
|---|---|
| `--board-frame`, `--board-tray` | Frame and bear-off trays. |
| `--board-bone` | The playing surface (bone, or felt in Midnight Felt). |
| `--board-point-dark`, `--board-point-light` | Alternating points. |
| `--board-number` | Point numbers, empty off-slot outlines. |
| `--board-shadow` | The board's drop shadow (`drop-shadow-board`). |
| `--die-stroke` | Die outlines. |

### Checkers (per theme, per mode)

`--checker-mine`, `--checker-mine-rim`, `--checker-opp`, `--checker-opp-rim`
(fills and rims), `--checker-mine-ring`, `--checker-opp-ring` (the faint turned
ring). The rim carries the checker's edge on a dark board.

### Arrows (per theme, per mode)

`--arrow-best`, `--arrow-good`, `--arrow-error`, `--arrow-blunder`: the move
arrows, one per tier (`BoardPanel.styles.ts`'s `arrow(tier)`), each at least
3:1 on that theme's bone. They sit on an opaque bone-coloured halo.

### Fonts (per theme)

| Token | Tailwind | Clubroom | Quiet Ink | Midnight Felt |
|---|---|---|---|---|
| `--theme-font-sans` | `font-sans` (the body default) | Geist | Geist | Inter |
| `--theme-font-serif` | `font-serif` | Newsreader | Geist (one family) | Playfair Display |
| `--theme-font-mono` | `font-mono` | Geist Mono | Geist Mono | JetBrains Mono |

The fonts load in `app/layout.tsx` with `next/font`; the theme file points
`--theme-font-*` at their variables. Code never names a font family.

### Display weight and emphasis (per theme)

- `--theme-display-weight` → `font-display`: the weight of serif titles and
  the verdict word (Clubroom 500, Quiet Ink and Midnight Felt 600).
- `--theme-emphasis-style` → `font-emphasis`: italic or normal, for the
  verdict word ("Correct." / "Not quite.") and the "vs" in titles (italic,
  except Quiet Ink).

### Type scale (theme-independent)

| Tailwind | Size / line height | Use |
|---|---|---|
| `text-display` | 38 / 41 (32 below md) | Page titles (PageShell "page"). |
| `text-title` | 28 / 31 | Card-level titles, the review question. |
| `text-heading` | 22 / 26 | Section titles (`shared.pageSectionTitle`), modal headings. |
| `text-figure` | 52 / 52 | Big numbers (rating, due count, PR). |
| `text-overline` | 11 / 16, +0.09em, 600 | Uppercase labels (`shared.overline`). |

### Radii (theme-independent)

`rounded-chip` (5px, chips), `rounded-control` (9px, buttons, inputs,
selects), `rounded-card` (14px, cards and list panels). `rounded-full` only
for pills: the Filter toggle, tag chips, the due badge.

### Shadows and scrim

- `shadow-card` (cards) and `shadow-raised` (modals, menus, dropdowns) are
  built from the per-theme `--shadow-color`.
- `drop-shadow-board` on the board SVG (`--board-shadow`).
- `--scrim` (`backdrop:bg-scrim`): behind a modal.

### Other chrome (per theme, per mode)

`--mode-ok`, `--mode-warn`: the navbar's mode dot (local write, Oracle
write).

### Adding a token

Add it to **every** theme file, in all three blocks where it varies by mode
(§6), and map it in `app/globals.css`'s `@theme inline`. `lib/themes.test.ts`
fails if a theme is missing a variable that `globals.css` maps.

## 3. Type rules

- **Serif** (`font-serif font-display`) for display text: page and section
  titles, card titles, big numbers, the verdict word, your notes.
- **Sans** (the default) for the UI: body, controls, tables, labels, dates,
  scores, ratings, counts.
- **Mono** (`font-mono`) **only** for moves and notation (`24/18 13/9*`),
  equities and losses (`−0.183`), position and match IDs, versions, and kbd.
  Never for dates, scores or counts.
- **Figures:** `tabular-nums` wherever numbers line up (tables, counts,
  progress). Serif figures also get `lining-nums`, so every theme's serif
  sets them at full height: `font-serif text-figure tabular-nums lining-nums`.
- Overlines are `shared.overline`, not hand-made uppercase.

## 4. Severity

One source, `lib/styles/shared.styles.ts` plus `lib/badges.ts`. Never pick a
severity colour by hand.

- **Tiers:** `SeverityTier` = `"best" | "good" | "error" | "blunder"`.
  Stored `ErrorSeverity` maps through `severityTier()`: `NONE` → best
  "Best", `DOUBTFUL` → good "Good", `ERROR` → error "Error", `BLUNDER` →
  blunder "Blunder" (`SEVERITY_TIER_LABELS`, `severityLabel()`).
- **A played move's tier:** `playedMoveTier(severity)`. Each severity as
  itself; a null `Decision.severity` (stored `NONE`) is Best.
- **NONE means Best and is never listed as a mistake.**
  `lib/mistakes.ts`'s `isListedMistake` lists only Error and Blunder.
- **DOUBTFUL means Good**, a mild tier, not an error. It isn't listed as a
  mistake either. PR is unaffected by either rule.
- **Fill:** `shared.severityChip(tier)` (fill, border and on-text) on the
  chip shape `shared.severityChipShape`. In JSX use `<SeverityBadge type={tier} />`.
- **Text:** `shared.severityText(tier)` (the `*-ink` shades).
- **Wash:** the `*-tint` tokens (Best, Error, Blunder; never Good).
- **Arrows:** the `arrow-*` tokens via `BoardPanel.styles.ts`'s `arrow(tier)`.
- The chip always carries the word (Best, Good, Error, Blunder), so
  severity never relies on colour alone.

## 5. Component patterns

All in `app/components/ui/` unless noted. Every one renders its look from
`lib/styles/shared.styles.ts`, takes an optional `className` for the
caller's extra classes (from the caller's own styles file), and has no
hooks unless noted, so server and client components can both use it.

### Button (`Button.tsx`)

`variant`: `primary` (the one main action in a view), `secondary` (every
other action; the default), `quiet` (an underlined text action). `size`:
`md` (38px, page level; the default), `compact` (34px, inside a card),
`small` (28px, table rows and the navbar); for `quiet` it's the text size.
With `href` it renders a Next `Link`, otherwise a `<button type="button">`.

- **Use** `<Button type="submit">Apply</Button>`,
  `<Button variant="primary" href="/review">Start review →</Button>`.
- **Not** `<button className={shared.buttonSecondary}>` in a new page, and
  never a new button look. `shared.buttonDanger` is the one extra
  (destructive table-row action).
- A disabled link has no `disabled`: add `pointer-events-none opacity-40`
  from the caller's styles (`PaginationLinks.styles.ts`'s `disabledLink`).

### Chips and badges

- **Severity:** `<SeverityBadge type={tier} />`. It is the severity chip;
  there's no separate SeverityChip.
- **Classification:** `<ClassificationBadge type={raw} />`, an outlined
  mono code (OG, MG, BLZ) with the full name as its tooltip.
- **Generic:** `<Badge config={…} />` with a `BadgeConfig` from
  `lib/badges.ts`. A config with a colour is a filled sans chip; without,
  the outlined code chip.
- **Tags:** `shared.tagChip` / `shared.tagChipAdd` (rounded-full, sunken).
- **Not** a hand-coloured `<span>` for a severity.

### Card (`Card.tsx`)

`<Card as="section" className={style.section}>`: surface, hairline,
`rounded-card`, `shadow-card`. Padding is the caller's (`p-5` sections,
`p-4` list panels, none for a table).

- **Not** a card inside a card, and not a box around a filter bar or the
  review session bar. Group with spacing first, a hairline second, a card
  last.

### Table (`Table.tsx`)

`Table`, `TableHead`, `TableHeadCell` (`numeric`), `TableBody`, `TableRow`
(`clickable`), `TableCell` (`kind`: `text`, `muted`, `numeric`, `chevron`).

- **Numeric cells** are right-aligned with `tabular-nums` (`kind="numeric"`,
  and `numeric` on the header). Secondary values (dates, IDs) are `muted`.
- **A clickable row** is `<TableRow clickable>` whose main cell holds a
  `Link` with `shared.tableRowLink` (stretched over the row, so mouse and
  keyboard both get one link), plus a trailing `kind="chevron"` cell.
- **Columns hidden on phones:** `className` with `max-md:hidden` on the
  header and body cells.
- Notation cells add `font-mono` from the page's styles; nothing else is mono.
- Older tables still compose `shared.table*` in their page's styles; they
  look the same. New tables use the components.

### Filter bar (`FilterBar.tsx`, `FilterSelect.tsx`, `FilterDisclosure.tsx`)

`<FilterBar summary="Any phase · All severities" defaultOpen={!hasFilter}>`
with `<FilterSelect>` children, passed to PageShell's `controls`. It renders
the `FilterDisclosure` (a one-line summary, hidden below md, and the
"Filter" pill), a plain GET form with no box, and the Apply button. Options
that load from the DB go in `<Suspense fallback={<FilterSelectFallback labels={[…]} />}>`.

- **Not** a boxed filter form, a client-side filter state, or a second
  Apply style.

### Modal (`Modal.tsx`)

The native `<dialog>` opened with `showModal()`: it's in the top layer (it
escapes the sticky navbar), traps focus and closes on Esc. Inside, use
`shared.modalHeading` / `modalText` / `modalError` / `modalButtons` and
`modalPrimaryButton` / `modalSecondaryButton` (or `Button`). Give it
`labelledBy` the heading's id. `dismissible={false}` for a modal that must
be answered.

- **Not** a `position: fixed` overlay div.

### PageShell (`PageShell.tsx`)

Every page renders into it. One outer width for every page (1240px, the
navbar's), so the title's left edge never moves.

- `width`: `wide` (board pages, the default), `medium` (lists and tables,
  `max-w-4xl`), `narrow` (`/status`, `max-w-2xl`). The narrower columns stay
  left-aligned to the same edge.
- `variant`: `page` (list and summary pages: the display title), `detail`
  (board pages: a smaller serif title, a faint sub line, no side padding
  below md), `session` (the review session, which draws its own header).
- Props: `breadcrumbs`, `overline`, `title`, `subtitle`, `actions`,
  `controls` (the FilterBar). `VsTitle` for "Game 2 *vs* cbj2".

### Breadcrumbs (`Breadcrumbs.tsx`)

Pass `breadcrumbs={[{ label, href }, …, { label }]}` to PageShell; the last
crumb (no `href`) is the current page. Don't render `Breadcrumbs` yourself.

### Pagination

`PaginationLinks` for server-rendered, query-param lists; `Pager` (client)
for client-side lists. Both are Prev / "Page N of M" / Next.

### Sources (`app/sources/`, `lib/sources.ts`)

`/sources` (write mode only, gated by `proxy.ts`) shows one `Card` per data
source from the registry in `lib/sources.ts`, in two rows. The top row has
the label as a section title and a one-line description on the left and,
from md, the actions on the right (the source's own client actions, from
`SOURCE_ACTIONS` in `app/sources/page.tsx`, then its links as compact
secondary `Button`s); below md they stack. Under a hairline, the status
facts as a `<dl>`: each an overline over its value, with an optional faint
detail line (Galaxy: LAST SYNC "4 days ago" over the exact time, LAST SYNC
ADDED, IN LIBRARY, LATEST MATCH), two per row on a phone and one line from
sm. The sync's own result message is neutral (`text-ink-muted`), and
Blunder's ink only on failure. A source's pages live under `/sources/<id>/`, with
breadcrumbs starting `Sources › <label>` (the label crumb links to
`/sources#<id>`, the card). Galaxy's actions: "Add token" (the shared
`TokenModal`, dismissible here) or "Sync", with the result on the card. The
navbar has no sync line; syncing starts from the card.

- **Add a source** with a registry entry (and an actions component if it
  has any), not a new page layout.

### The board (`app/components/match-analysis/`)

`BoardPanel` is the only way to show a position: the SVG board (`Board.tsx`,
private to it), the arrows, the Played / Best chips (`decisionChip`) and,
on DB-backed pages, the note and review tools. `bleed` for pages without
side padding below md. `Dice` is separate (also used by the lists).

- **Not** a new board drawing, and not colours for checkers, points or
  arrows outside the board tokens.
- Points are numbered from the bottom player's view, the decision-maker is
  at the bottom, dice show the higher die first, a stack over 5 shows "+N".

### Keyboard keys

`shared.kbd` for a keycap. A shortcut goes in three places: the handler,
`aria-keyshortcuts` on the control it triggers, and `lib/shortcuts.ts` (so
the "?" help lists it).

### GameSwitcher

The segmented game row on the match page and the replay header.

## 6. Themes

Three themes, registered in `lib/themes.ts` (`THEMES`): Clubroom (the
default), Quiet Ink, Midnight Felt.

### How the active theme is chosen

- `<html data-theme="<id>" data-mode="light|dark|system">`, set by the root
  layout (`app/layout.tsx`) from the `bgtheme` cookie, on the server, so the
  first HTML is already themed (nothing flashes).
- The cookie is `bgtheme=<theme>.<mode>` (e.g. `midnight-felt.dark`), one
  year, `Path=/`, `SameSite=Lax`, per browser, no DB and no write gate.
  `/settings` writes it in the browser, sets the two attributes at once and
  calls `router.refresh()`.
- Each part is validated against the registry and falls back on its own
  (Clubroom, System). A garbage cookie can't break a page.
- `system` follows `prefers-color-scheme`. Tailwind's `dark:` variant follows
  `data-mode` (dark, or system on a dark OS); colours rarely need it.

### Adding a theme

1. **One CSS file**, `app/themes/<id>.css`, setting every variable listed
   in `app/themes/clubroom.css`'s header, in three blocks:
   `[data-theme="<id>"]` (light), `[data-theme="<id>"][data-mode="dark"]`,
   and the same dark values again under `@media (prefers-color-scheme: dark)`
   as `[data-theme="<id>"][data-mode="system"]`. **The two dark blocks must
   be identical** (plain CSS can't share one block between a selector and a
   media query).
2. **One `@import`** in `app/globals.css`.
3. **One registry entry** in `THEMES` (`id`, `label`, `fonts` for the
   Settings page).
4. **Fonts:** a new family loads in `app/layout.tsx` with `next/font`,
   `variable: "--font-<name>"` and **`preload: false`** (only the default
   theme's fonts are preloaded), and its variable goes in the `<html>`
   class list. The theme file points `--theme-font-*` at it.
5. Check contrast (§8) for every text pair, the chips, the arrows on the
   bone, and focus, in light and dark.

`lib/themes.test.ts` checks the completeness: the CSS file and its import,
the three selectors, every mapped variable defined, the fonts loaded (and
`preload: false` for non-default ones), and the two dark blocks identical.

## 7. Do and don't

- **Do** use tokens. **Don't** write a hex, `rgb()`/`hsl()` colour, a raw
  palette class (`zinc-500`, `red-600`, `bg-black`, `text-white`), an
  arbitrary colour (`bg-[#…]`) or a font-family name in code.
  `lib/styleGuard.test.ts` fails on any of them outside comments and the
  theme CSS. A mix of tokens (`bg-[color-mix(in_srgb,var(--color-accent)_9%,var(--color-surface))]`)
  is fine.
- **Don't** add `dark:` colour variants; the tokens switch.
- **Don't** write Tailwind classes inline in JSX. They go in the
  `[name].styles.ts` next to the component (the `styling-conventions`
  skill); shared values in `lib/styles/shared.styles.ts`.
- **Do** use the components in §5. **Don't** re-style a button, card,
  table, chip or modal per page.
- **Don't name Galaxy in general UI.** The app is source-neutral: say "the
  source's PR" (`lib/sourcePr.ts`), not "Galaxy's". Galaxy is named only
  on `/sources/galaxy/**`, in the "View on Galaxy" link
  (`lib/externalMatchUrl.ts`), the Galaxy card on `/sources` (its entry in
  the source registry, `lib/sources.ts`), the token prompt
  (`app/components/galaxy/TokenModal.tsx`), source-specific code (ingest,
  sync, the Galaxy translator and client) and the `/status` notes. The
  navbar says "Sources", never a source's name. The guard test enforces
  it, with an allowlist and a reason per entry.
- **Don't** use colour except for severity and the accent. **Don't** add a
  new hue; if you need one, it's a new token in every theme, approved first.
- **Don't** use mono for anything but notation, equities, IDs and kbd.
- **Don't** box everything. No card in a card.
- **Don't** hard-code mockup content (tags, notes, counts).
- **Don't** map severity yourself: `severityTier`, `playedMoveTier`,
  `severityChip`, `severityText`.

## 8. Accessibility

- **Contrast:** at least **4.5:1** for text (including `ink-faint` on
  `paper` and `surface`; that's why it's not used on `sunken`), and at least
  **3:1** for UI parts: control borders that carry meaning, the focus ring,
  the board arrows on the bone, checker rims. Check a new token or theme in
  both modes.
- **Focus:** one visible ring everywhere, `:focus-visible` with a 2px
  `--focus` outline at a 2px offset (`app/globals.css`). Where a neighbour
  would hide it (table rows, inputs), move it inside with
  `shared.focusRingInset`. Never remove an outline without a replacement.
- **Keyboard rows:** a selectable list row is focusable (`tabIndex={0}`)
  and selects on Enter or Space (`DecisionList.tsx`). A clickable table row
  is a real link (`shared.tableRowLink`).
- **Shortcuts:** `aria-keyshortcuts` on the control, and the key listed in
  `lib/shortcuts.ts` for the "?" help. Shortcuts are ignored while typing.
- **Sticky navbar:** `scroll-padding-top` keeps focused and anchored
  elements below it.
- **Modals:** the native `<dialog>` (focus trap, Esc), labelled by its
  heading.
- **Severity** is never colour alone: chips carry the word.

## 9. Screenshots and design review

`scripts/design-screenshots.ts` shoots every main page at 1440 and 390,
light and dark, into `design/screenshots/<date>/` (gitignored). It only
talks HTTP to a running app; start one against the **local** database, in
write mode:

```
npm run build && ENABLE_WRITE_MODE=true npx next start -p 3300
npx tsx scripts/design-screenshots.ts --theme=clubroom --date=2026-10-09-phase4
```

The shots include `/sources` and `/sources/galaxy/matches` (its token
prompt, since the script has no token), and the review session's checker
backs on both tabs (Best, the default, and Yours).

- `--theme=<id>`: a theme from `lib/themes.ts`, set through the `bgtheme`
  cookie in system mode; shots go to `<date>/<id>/`. Without it, the
  default theme into `<date>/`.
- `--review-decisions=a,b,c`: Decision ids put into review for the
  `/review` shots, added through the API first and removed afterwards (also
  on failure). Answers are stubbed in the browser, so no `ReviewLog` rows.
  Check afterwards that the review tables are back to where they were.
- `--nav-only`: only the navbar shots (768, 1024, 1280, 1440), for a read-only
  server (`ENABLE_WRITE_MODE=false npx next start -p 3301`, then
  `--base-url=http://localhost:3301 --nav-only`).
- `--base-url=<url>` (default `http://localhost:3300`), `--date=<name>`
  (the folder; default today).

**When the designer reviews:** a change that adds a new page or a new kind
of visible component (a new screen, card type or panel) gets a screenshot
run and the designer's review before it counts as done. Small UI tweaks,
logic-only changes and data work skip it; this doc, the
`styling-conventions` skill, the shared components, the style-guard test
and the visual suite (`npm run test:visual`) cover everyday consistency.
