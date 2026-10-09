# Visual regression: BoardPanel + shared list/filter/badge markup

Playwright suite protecting `app/components/match-analysis/BoardPanel.tsx`
across its three real call sites — `/matches/[matchId]`,
`/sources/galaxy/matches/[matchId]`, and `/mistakes` — since it's shared, and a
change made while working on one page's board usage could silently break
the others. This is a separate suite/runner from the Vitest unit tests
(`vitest.config.ts` / `npm test`); it never runs as part of that command.

Built as the safety net *before* the planned CSS restructuring work, not
after — the point is to have something that catches "the restructuring
changed how the board looks or where it sits" before that work starts.

**Important scope note:** the original 12 tests screenshot *only* the
`[data-testid="board-panel"]` element, never the full page. That means
list rows, filter controls, badges, and PR summaries render on the pages
these tests visit but are entirely outside the screenshot's clipped
region — invisible to this suite even though the page itself is "tested."
The "Shared markup visual regression" tests below (4 added 2026-09-28,
a 5th added 2026-10-01) close part of that gap specifically for the components an
inventory found still had inline Tailwind classes and no coverage at all:
`MistakesSection.tsx` (its own chrome, excluding `BoardPanel`),
`MoveDelta` (now its own `MoveDelta.tsx`, shared by `MistakesSection.tsx`,
`DecisionListWithDetail.tsx` and `GameReplay.tsx`), and `DecisionListWithDetail.tsx`'s own list
region. This is deliberately *not* full coverage of every unconverted
file (see PROGRESS.md's inventory entry) — just enough to make converting
*this specific markup* to `.styles.ts` files safe, since that's the next
planned work.

## What it does

`board-visual.spec.ts` picks 5 representative real decisions from match
46576635 (the same match the Vitest `gnuPositionId` regression tests use):

- **bar-checkers** — a mistake played with a checker still on the bar
- **near-bearoff** — a mistake in the bear-off phase
- **normal-midgame** — an unremarkable midgame mistake
- **both-arrows** — a two-submove move, drawing two arrows on the board at once
- **clean-move** — no error (played move equals the best move), so
  `MoveDelta` collapses its usual my-label/best-label pair into one label
  (added 2026-10-01, alongside that collapse behavior itself — see
  PROGRESS.md's entry for that date)

bar-checkers and normal-midgame are screenshotted in all three page
contexts; **clean-move, near-bearoff and both-arrows only on `/mistakes`**
— `MistakesSection.tsx`'s own tables (`/matches`/`/sources/galaxy/matches`) only
ever list `isMistake: true` decisions outside Galaxy's mild "Good" tier
(`lib/mistakes.ts`'s `partitionMistakes`/`isListedMistake`; near-bearoff
and both-arrows are stored DOUBTFUL = "Good", which stopped counting as an
error on 2026-10-07), so none of those three can appear there, and
`board-visual.spec.ts` uses a separate `MISTAKE_DECISIONS` (bar-checkers and
normal-midgame) for those two contexts' own loops rather than forcing all
five through a uniform grid. 9 board screenshots total (2×2 + 5; 13 before
2026-10-07, when the two Good-tier decisions were also shot on `/matches`
and `/sources/galaxy/matches`), each scoped to just the
`[data-testid="board-panel"]` element — never a
full-page screenshot. `/matches/[matchId]` and `/sources/galaxy/matches/[matchId]`
are client components that fetch game data over the network; their fetches
are mocked (`page.route()`) to serve the exact same fixture JSON
(`e2e/fixtures/match-46576635-game-{5,6,7}.json`, real payloads, not
fabricated), so both are fully deterministic regardless of what's actually
in the real DB right now. `/matches/[matchId]`'s decision-notes lookup
(`GET /api/decision-notes?matchId=`) is mocked too, to "no DB decisions",
so no note UI renders there and its arrival can't race a screenshot.
`/sources/galaxy/matches/[matchId]` never fetches notes (it's live Galaxy data and
read-only). The note UI itself is covered by the `/mistakes`
`decision-card` screenshot, which shows the editable note card (and, since
2026-10-07, the review card below it: "Add to review" and the empty tag
editor — `bg_test` has no review cards or tags): that needs
write mode, so `playwright.config.ts` pins `ENABLE_WRITE_MODE=true` on the
:3100 server instead of depending on `.env`. `/mistakes` is a server component reading Prisma
directly — no fetch to mock — so it's made deterministic a different way:
a separate local MySQL schema, `bg_test` (same Docker container as the
normal `app_dev`), seeded with exactly these decisions
(`e2e/seed-test-db.ts`), and the whole suite runs against a dedicated dev
server (`playwright.config.ts`'s `webServer`, port 3100) whose
`DATABASE_URL`/`DATABASE_URL_READONLY` point at `bg_test` instead of
whatever the real `.env` has configured. Reached via `/mistakes`'s own
classification/category/severity filters (real query params, the same UI
a visitor uses), then a click by exact move-label text — the same
selection technique as the other two contexts, not a special-cased deep
link. `bg_test` is small enough (10 rows) that this needs no shortcut: two
of the five decisions do share one filter combo, but the click-by-label
step already disambiguates them, same as it does for the much larger real
mistake lists on `/matches`/`/sources/galaxy/matches`. All 9 board screenshots are now
fully deterministic, independent of the real dev DB's live state — the
*only* variable across all three contexts is the surrounding page.

## Shared markup coverage (5 tests, added 2026-09-28 + 2026-10-01)

All reuse the exact same mocked/seeded page visits as the board tests
above — no new fixtures beyond the one `clean-move` decision (see "What it
does" above), no other new live-data dependency:

- **`mistake-row-list` on `/mistakes`** — screenshots
  `[data-testid="mistake-row-list"]` (added to `DecisionListWithDetail.tsx`'s
  own list wrapper) after filtering to the `bar-checkers`/`normal-midgame`
  combo (`middle_game`/`checker`/`error` — one filter shared by two of
  the representative decisions, see `DECISIONS`' own comment), so the
  list has 2+ rows and exercises both the selected-row highlight and an
  unselected row's resting style, not just a single row.
- **`move-delta` — active/inactive tab states on `/mistakes`** — same page
  visit as above, scoped to one specific row's own `[data-testid="move-delta"]`
  (via a `tr` locator filtered by that row's exact label text — a bare
  `getByTestId` would be ambiguous once the list has 2+ rows). Two
  screenshots: `move-delta-my-active.png` right after selecting the row
  (default tab), and `move-delta-best-active.png` after clicking its own
  "best" label — covering both branches of `MoveDelta`'s conditional
  underline styling without needing to hardcode the exact best-move
  notation text.
- **`move-delta` — collapsed (no error) on `/mistakes`** (added 2026-10-01)
  — the third `MoveDelta` branch: when the played move has no error
  (`Decision.isMistake === false`), my-label/best-label collapse into one
  green label instead of a redundant identical pair. Uses the `clean-move`
  decision specifically (the one `DECISIONS` entry with `isMistake: false`).
  Asserts the element has exactly one child `<span>` (a structural check a
  screenshot diff alone can't make) before screenshotting it.
- **`mistakes-section` on `/matches/[matchId]` and `/sources/galaxy/matches/[matchId]`**
  — screenshots `[data-testid="mistakes-section"]`, a new wrapper `<div>`
  around `MistakesSection.tsx`'s "You"/Game filters and the 3 PR summary
  cards. This is the one place this addition went beyond adding a bare
  attribute to an existing element: there was no single existing element
  spanning exactly "filters + PR summary" without also including the board
  (screenshotting the board here would reintroduce the GPU-jitter flake
  documented below, for a region already covered by the 13 tests above).
  The wrapper's own `className="flex flex-col gap-6"` exactly reproduces
  the outer container's spacing — verified to introduce zero visual change
  via this same suite (16/16 passing against the pre-existing baselines,
  not just reasoned about).

**`/repeated-positions` is not covered** — it renders the same
`DecisionListWithDetail`/`MoveDelta`, but `bg_test` (see "Setup" below)
only seeds `Match`/`Game`/`Decision`, no `RepeatedPosition` rows, and none
of the 5 representative decisions are necessarily a *repeated* position in
this 10-row dataset. Adding coverage there would mean extending the seed
script and the recompute step, not reusing an existing page visit —
skipped as not cheap, per the instruction that introduced this section.

**No `app/mistakes/page.tsx` (or any other application-route) changes were
needed to make this work** — `/mistakes`, `lib/local-client.ts`, and
everything else keep querying `prismaReadOnly` exactly as before; only the
connection string differs, and only for this one dedicated test server
process (see "Setup" below). The one real production-adjacent file this
*did* need to touch is `next.config.ts` (a `distDir` override, off by
default — see "Running it" below for why).

## Running it

```
npm run test:visual
```

The dedicated server (port 3100, `bg_test`-backed) starts automatically via
Playwright's `webServer` config — it's a *second* `next dev` process
(separate from your normal one on :3000, which this suite never touches),
using its own build cache directory (`.next-test/`, see `next.config.ts`'s
`distDir` override — a second `next dev` for the same project otherwise
refuses to start, regardless of port). First run seeds nothing by itself —
run the one-time setup below before the first `npm run test:visual`, or
whenever `e2e/fixtures/seed-data.json` changes.

Needs Chromium installed once: `npx playwright install chromium`.

## Setup (one-time, or after a fresh `docker compose up`)

1. Create the `bg_test` schema and grant your local MySQL user access to
   it. The minimal setup uses the `app`/`app` user `docker-compose.yml`
   creates (full privileges), the same default `.env.example` uses for
   `app_dev`. Local can also mirror production's privilege split: the
   existing local container has hand-created `bg_db_rw`/`bg_db_ro` users
   with production's grant shapes on both `app_dev` and `bg_test` (see
   `.env.example`), and `.env.test` can point `DATABASE_URL`/
   `DATABASE_URL_READONLY` at those instead:
   ```sql
   CREATE DATABASE IF NOT EXISTS bg_test CHARACTER SET utf8mb4;
   GRANT ALL PRIVILEGES ON bg_test.* TO 'app'@'%';
   FLUSH PRIVILEGES;
   ```
2. Copy `.env.test`'s shape from the block already in this file below (or
   from `.env.test` itself if it's still on your machine — it's gitignored,
   like every other `.env*` file, so a fresh checkout needs it recreated):
   ```
   DATABASE_URL="mysql://app:app@localhost:3306/bg_test"
   DATABASE_URL_READONLY="mysql://app:app@localhost:3306/bg_test"
   ```
3. Apply the schema: `DATABASE_URL="mysql://app:app@localhost:3306/bg_test" npx prisma migrate deploy`
4. Seed it: `npx tsx e2e/seed-test-db.ts` (idempotent — safe to re-run any
   time; re-run it whenever `e2e/fixtures/seed-data.json` changes).

## Baselines

Committed under `e2e/board-visual.spec.ts-snapshots/` — this is
deliberate, not an oversight: without committed baselines there's nothing
to regress against on a fresh checkout or in CI.

### Updating a baseline after a deliberate change

1. Make your change (e.g. the CSS restructuring).
2. Run `npx playwright test --update-snapshots`.
3. **Look at the diffs before trusting them** — either open the updated
   PNGs directly, or re-run without `--update-snapshots` first to see
   Playwright's side-by-side diff output (`test-results/.../*-diff.png`)
   for anything that's about to change. Confirm every changed screenshot
   looks the way you expect (the board still renders correctly, nothing
   unrelated shifted) before committing.
4. Commit the updated PNGs under `e2e/board-visual.spec.ts-snapshots/`
   alongside your change, in the same commit or PR — a baseline update
   with no accompanying explanation of *why* the board's appearance
   changed is a red flag in review.

### If a test fails unexpectedly (not from a deliberate change)

That's the suite doing its job — a shared-component change broke one or
more of its call sites (or all of them; see below). Look at
`test-results/.../*-diff.png` for the failing test to see exactly what
moved, then fix the regression rather than updating the baseline.

### Reading which contexts failed

Failures that survive all retries (see below) are real — check for a
`-retry2` (or `-retryN`) suffix in the failing test's trace/output path to
tell a genuine failure apart from noise that just hadn't been retried yet.

- All 9 fail together → the bug is in `BoardPanel.tsx` or `Board.tsx`
  themselves (shared by all three).
- Only the `/mistakes` tests fail (5, since `clean-move` has no
  `/matches`/`/sources/galaxy/matches` counterpart — see "What it does" above) →
  the bug is specific to `/mistakes`'s own integration (`DecisionCard.tsx`,
  `lib/decisionFromRow.ts`) — real, verified at the time there were 4
  representative decisions: swapping `myMoveNotation`/`bestMoveNotation` in
  `lib/decisionFromRow.ts` (used only by `/mistakes`) failed exactly those
  4 `/mistakes` tests and left the other 8 green.
- Only the `/matches`/`/sources/galaxy/matches` tests fail → the bug is in
  `MistakesSection.tsx` (shared by those two, not `/mistakes`) or one of
  those two page files specifically.
- `mistake-row-list` and `move-delta` fail together → the change is in
  `MoveDelta` itself (rendered inside `mistake-row-list`'s own screenshot
  region, so a real change there legitimately shows up in both) — verified
  directly via mutation testing, not assumed.
- Only `mistakes-section` (both contexts) fails → the change is in
  `MistakesSection.tsx`'s filters/PR-summary chrome specifically, not
  `MoveDelta` or the mistake tables below it.

## Known flake source, mitigated with retries

Headless Chromium's rasterization of some diagonal-arrow board states
isn't fully deterministic between separate process runs, even with
`--disable-gpu` (see `playwright.config.ts`) — typically ~1% of the
board-panel image's pixels, on rows with two non-parallel arrows. This
showed up on `/matches`/`/sources/galaxy/matches` first (their mocked games load
one at a time and re-render as each arrives — fixed by waiting for game
3's own option in the "Game" `<select>` to attach, a real settle signal,
before clicking — see `waitForAllGamesLoaded`), and later on `/mistakes`
too after its tests switched from a direct deep link to filter-and-click
(the same technique the other two already used).

Deliberately **not** handled by loosening `maxDiffPixelRatio`: a real
single-arrow regression measured the same ~1% magnitude as this jitter, so
any pixel-count tolerance wide enough to absorb the noise would hide that
whole class of real bug too (see the comment on `expect.toHaveScreenshot`
in `playwright.config.ts`). Instead, `retries: 2` (also in
`playwright.config.ts`, not just for CI) — the standard mitigation for
this exact class of rendering noise: a real regression fails the same way
on every attempt, so it still fails the suite; this jitter has never
failed twice in a row in local testing, so a retry clears it. A test
marked "flaky" in the output (not "failed") means exactly this — passed
on retry, nothing to investigate.

Confirmed again while adding the 4 shared-markup tests (2026-09-28): 10
consecutive full-suite runs, 7/10 clean, 3/10 with exactly one `/mistakes`
board test flaking (a different decision each time — `normal-midgame`,
`near-bearoff`, `both-arrows`), always recovering on retry, never one of
the 4 new tests. Also observed once that a *board* test can fail all 3
attempts in the same run as an unrelated new-test mutation (higher system
load under the full 16-test parallel run, apparently enough to correlate
two separate jitter events) — confirmed it was coincidental, not caused by
the mutation, by re-running that one board test in isolation 5/5 clean
with the mutation still reverted. If this happens again, isolate the
suspect test with `--grep` before assuming a real regression.

## Fixtures

`e2e/fixtures/match-46576635-game-{5,6,7}.json` are real Galaxy
`game_reviews` payloads for those three games (only opaque `user_id`
strings, no names/ratings — same shape already used elsewhere in this
codebase, e.g. `lib/local-client.ts`'s reconstruction). `player-identities.json`
is a small hand-written stand-in for `/api/player-identities`, marking one
`user_id` (the one all 5 representative decisions belong to) as `isMe`, so
`MistakesSection.tsx`'s player-scoping logic resolves deterministically
regardless of what's actually in the real `PlayerIdentity` table.

`e2e/fixtures/seed-data.json` is a one-time real snapshot (opponent name
anonymized to "Test Opponent") of exactly the rows `e2e/seed-test-db.ts`
writes into `bg_test`: the Match, its 3 Games, and 10 Decisions — the 5
representative checker decisions plus each one's immediately preceding
`dice_rolled` sibling row, kept for historical/snapshot fidelity (this is a
real one-time capture, not hand-assembled) even though nothing reads them
as siblings anymore — roll, cube, colour and labels all come from each
row's own `raw` (its GNU Match ID and review). Since 2026-10-07 the
snapshot holds only the columns the schema still has; the dropped,
derivable ones were removed from it (`reports/2026-10-07-column-audit.md`,
`docs/field-mapping.md`'s "Derived from raw"). Deliberately
not a full match/account replica, just what these 5 tests
render.
