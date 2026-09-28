// Visual regression for the shared BoardPanel component (see
// app/components/match-analysis/BoardPanel.tsx), tested across its three
// real call sites so a change to BoardPanel itself, or to one page's own
// integration of it, is caught precisely — screenshots are of the real
// rendered page, never an isolated component sandbox. See e2e/README.md
// for the baseline-update workflow.
//
// A second describe block below ("Shared markup visual regression") covers
// list/filter/badge markup that these board-only screenshots never touch
// (they're clipped to board-panel's own element) — see e2e/README.md's
// "Shared markup coverage" section for what it does and doesn't cover.
//
// Same 4 representative decisions, same underlying real data (match
// 46576635, games 5/6/7 — the same match used by the Vitest suite's
// gnuPositionId regression tests), rendered in all three contexts. All 12
// tests run against one dedicated dev server (playwright.config.ts's
// webServer, port 3100 — never the real dev server on :3000, and never
// affected by whatever the real .env currently points at):
//   - /matches/[matchId] and /galaxy/matches/[matchId]: client components
//     that fetch game data over the network — mocked via page.route() to
//     serve the exact fixture JSON in e2e/fixtures/, so which DB (if any)
//     the server is connected to is irrelevant to these 8.
//   - /mistakes: a server component reading Prisma directly — no fetch to
//     mock, so it needs the dedicated server's DATABASE_URL/
//     DATABASE_URL_READONLY (overridden to a separate local schema,
//     bg_test — see .env.test, e2e/README.md) actually pointed somewhere
//     deterministic. Seeded with exactly these decisions by
//     e2e/seed-test-db.ts (run once, or whenever the seed data changes).
//     Reached via /mistakes's own classification/category/severity filters
//     (same UI a real visitor uses), then a click by exact move-label text
//     — the same selection technique as the other two contexts. bg_test is
//     small enough (8 rows) that this needs no special-cased deep link:
//     two of the four decisions share a filter combo (both middle_game/
//     CHECKER/ERROR), so that filter alone isn't unique, but the
//     click-by-label step already disambiguates it, same as /matches and
//     /galaxy/matches do for their much larger mistake lists.
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page, type Route } from "@playwright/test";

const MATCH_ID = "46576635";
const FIXTURES_DIR = path.join(__dirname, "fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));
}

// Both /matches/[matchId] and /galaxy/matches/[matchId] fetch gameIndex
// 1, 2, 3, ... in order until they get a 404 — which literal gameIndex
// number a fixture is served under is cosmetic (just becomes that page's
// "Game N" label), so games 5/6/7 are remapped to slots 1/2/3 here purely
// to keep the loop short (3 games, not fetching up to MAX_GAMES=20).
const GAME_FIXTURES: Record<number, unknown> = {
  1: loadFixture("match-46576635-game-5.json"),
  2: loadFixture("match-46576635-game-6.json"),
  3: loadFixture("match-46576635-game-7.json"),
};

const PLAYER_IDENTITIES = loadFixture("player-identities.json");

interface RepresentativeDecision {
  name: string;
  description: string;
  // /mistakes's own filter params (classification/category/severity) —
  // real query params a visitor would use, not a test-only shortcut. Not
  // always unique to one decision (see the header comment above); the
  // click-by-label step below is what actually disambiguates.
  mistakesFilter: { classification: string; category: string; severity: string };
  // The exact my-move notation text MoveDelta renders — used to click the
  // right row in MistakesSection's mistake table (/matches, /galaxy/matches)
  // or DecisionListWithDetail's list (/mistakes). Must be unique enough
  // within the filtered results not to collide with another row's label.
  myLabel: string;
}

const DECISIONS: RepresentativeDecision[] = [
  {
    name: "bar-checkers",
    description: "a checker mistake played with a checker still on the bar",
    mistakesFilter: { classification: "middle_game", category: "checker", severity: "error" },
    myLabel: "bar/22 23/20 8/5(2)",
  },
  {
    name: "near-bearoff",
    description: "a checker mistake in the bear-off phase",
    mistakesFilter: { classification: "race", category: "checker", severity: "doubtful" },
    myLabel: "6/3 2/off",
  },
  {
    name: "normal-midgame",
    description: "an unremarkable midgame checker mistake",
    // Same filter as bar-checkers above — deliberately not unique; the
    // click-by-label step is what actually picks the right one.
    mistakesFilter: { classification: "middle_game", category: "checker", severity: "error" },
    myLabel: "10/4 8/4",
  },
  {
    name: "both-arrows",
    description: "a two-submove move, rendering two arrows on the board at once",
    mistakesFilter: { classification: "opening_game", category: "checker", severity: "doubtful" },
    myLabel: "24/23 13/11",
  },
];

function gameIndexFromUrl(url: string): number | null {
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  const n = Number(segments[segments.length - 1]);
  return Number.isInteger(n) ? n : null;
}

async function fulfillGame(route: Route) {
  const gameIndex = gameIndexFromUrl(route.request().url());
  const fixture = gameIndex !== null ? GAME_FIXTURES[gameIndex] : undefined;

  if (!fixture) {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not found." }),
    });
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(fixture),
  });
}

// Mocks every network dependency /matches/[matchId] and
// /galaxy/matches/[matchId] have — same fixture data for both, so the only
// variable between their screenshot sets is the surrounding page.
async function mockGameFetches(page: Page) {
  await page.route(`**/api/matches/${MATCH_ID}/*`, fulfillGame);
  await page.route(`**/api/galaxy/matches/${MATCH_ID}/*`, fulfillGame);
  await page.route("**/api/player-identities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PLAYER_IDENTITIES),
    })
  );
}

const boardPanel = (page: Page) => page.getByTestId("board-panel");

// Not part of the original board-only suite — added to cover shared
// list/filter/badge markup the board-panel screenshots above never touch
// (they're clipped to board-panel's own bounding box). See PROGRESS.md's
// entry for this addition for the full reasoning: these three testids
// (mistake-row-list, move-delta, mistakes-section) were added specifically
// so a future Tailwind-to-styles.ts conversion of that markup has a real
// guard, the same way the board conversion already did.
const mistakeRowList = (page: Page) => page.getByTestId("mistake-row-list");
const mistakesSection = (page: Page) => page.getByTestId("mistakes-section");

// Both /matches/[matchId] and /galaxy/matches/[matchId] fetch their 3
// mocked games one at a time, re-rendering after each arrives — clicking a
// row before the last one lands risked an intermittent extra re-render
// landing right around the screenshot, which was flaking specifically on
// the both-arrows case (the two-line diagonal-arrow rendering is
// apparently the most timing-sensitive one to repaint). Game 3's own
// option in the "Game" <select> (shared by both pages, via
// MistakesSection.tsx) only exists once all 3 mocked games have arrived,
// so waiting for it (attached, not necessarily visible inside a closed
// select) is a real settle signal instead of a guessed delay.
async function waitForAllGamesLoaded(page: Page) {
  await page.locator("#game-select option", { hasText: "Game 3" }).waitFor({ state: "attached" });
}

test.describe("BoardPanel visual regression", () => {
  for (const decision of DECISIONS) {
    test(`/matches/[matchId] board — ${decision.name} (${decision.description})`, async ({
      page,
    }) => {
      await mockGameFetches(page);
      await page.goto(`/matches/${MATCH_ID}`);
      await waitForAllGamesLoaded(page);
      await page.getByText(decision.myLabel, { exact: true }).first().click();
      await expect(boardPanel(page)).toBeVisible();
      await expect(boardPanel(page)).toHaveScreenshot(`matches-${decision.name}.png`);
    });

    test(`/galaxy/matches/[matchId] board — ${decision.name} (${decision.description})`, async ({
      page,
    }) => {
      await mockGameFetches(page);

      // Token is in-memory React context state (app/GameStatsProvider.tsx)
      // — a fresh page.goto() to /galaxy/matches/[matchId] directly would
      // always see it as null and redirect away. Go through the real
      // connect flow, then a client-side navigation (the "jump to match"
      // form, which uses router.push — no full reload) to preserve it.
      // The token value itself never has to be real: every fetch it's used
      // in is mocked above.
      await page.goto("/galaxy/matches");
      await page.getByRole("button", { name: "Paste authorization" }).click();
      await page.locator("#auth").fill("Bearer visual-test-token");
      await page.getByRole("button", { name: "Connect" }).click();
      await page.getByPlaceholder("Match ID").fill(MATCH_ID);
      await page.getByRole("button", { name: "Jump to match" }).click();
      await page.waitForURL(`**/galaxy/matches/${MATCH_ID}`);
      await waitForAllGamesLoaded(page);

      await page.getByText(decision.myLabel, { exact: true }).first().click();
      await expect(boardPanel(page)).toBeVisible();
      await expect(boardPanel(page)).toHaveScreenshot(`galaxy-matches-${decision.name}.png`);
    });

    test(`/mistakes board — ${decision.name} (${decision.description})`, async ({ page }) => {
      // Server component reading Prisma directly — no route to mock.
      // Resolves against the dedicated bg_test-backed server (baseURL, see
      // playwright.config.ts). Real filter params, same as a visitor would
      // use; click-by-label picks the exact decision (see mistakesFilter's
      // comment above — not every filter combo here is unique on its own).
      const { classification, category, severity } = decision.mistakesFilter;
      await page.goto(
        `/mistakes?classification=${classification}&category=${category}&severity=${severity}`
      );
      await page.getByText(decision.myLabel, { exact: true }).first().click();
      // The click can land before React finishes hydrating the
      // server-streamed list (a static DOM element that looks clickable
      // before its handler is attached) — when the target decision is
      // already the default selection this is harmless, but it still
      // produced a rare, tiny (~1%) pixel diff, the same magnitude as the
      // GPU-jitter flake fixed elsewhere in this file, on a board with two
      // non-parallel arrows. Waiting for the board panel to actually show
      // this decision's own label (BoardPanel renders selected.myLabel in
      // its own info box, inside the screenshotted element) is a real
      // correctness signal, not a guessed delay — the click is a no-op to
      // wait on if already selected, and a genuine re-render to wait out
      // otherwise, either way ensuring the screenshot isn't mid-transition.
      await expect(boardPanel(page)).toContainText(decision.myLabel);
      await expect(boardPanel(page)).toHaveScreenshot(`mistakes-${decision.name}.png`);
    });
  }
});

// Shared list/filter/badge markup that the board-only suite above never
// exercises (board-panel screenshots are clipped to their own element,
// which excludes all of this). Reuses the exact same mocked/seeded page
// visits as the tests above — no new fixtures, no live data. See
// PROGRESS.md's entry for this addition: this suite existing is what makes
// converting this markup to lib/styles-style .styles.ts files safe to do
// later, the same way the board conversion's own suite already protects it.
test.describe("Shared markup visual regression", () => {
  // bar-checkers/normal-midgame share one mistakesFilter (middle_game/
  // checker/error — see DECISIONS' own comment), so filtering on it
  // surfaces at least 2 rows — enough to exercise both the selected-row
  // highlight and an unselected row's own resting style, not just a
  // single-row list.
  const MULTI_ROW_DECISION = DECISIONS[0]; // bar-checkers

  test("mistake-row-list on /mistakes", async ({ page }) => {
    const { classification, category, severity } = MULTI_ROW_DECISION.mistakesFilter;
    await page.goto(
      `/mistakes?classification=${classification}&category=${category}&severity=${severity}`
    );
    await page.getByText(MULTI_ROW_DECISION.myLabel, { exact: true }).first().click();
    // Same correctness-before-screenshot signal the board tests already
    // use for /mistakes — the click can land before hydration finishes.
    await expect(boardPanel(page)).toContainText(MULTI_ROW_DECISION.myLabel);
    await expect(mistakeRowList(page)).toHaveScreenshot("mistake-row-list.png");
  });

  test("move-delta — active/inactive tab states on /mistakes", async ({ page }) => {
    const { classification, category, severity } = MULTI_ROW_DECISION.mistakesFilter;
    await page.goto(
      `/mistakes?classification=${classification}&category=${category}&severity=${severity}`
    );
    // Scoped to the specific row by its own label text, not .first() on the
    // page — mistake-row-list has multiple move-delta elements once filtered
    // down to 2+ rows, and a bare getByTestId would be an ambiguous locator.
    const row = page.locator("tr", { hasText: MULTI_ROW_DECISION.myLabel });
    const moveDelta = row.getByTestId("move-delta");

    // Selecting the row (clicking its own "my" label) is the same action
    // the board tests already use — defaults this row's own active tab to
    // "my", the first conditional branch (underline on my, not on best).
    await row.getByText(MULTI_ROW_DECISION.myLabel, { exact: true }).click();
    await expect(boardPanel(page)).toContainText(MULTI_ROW_DECISION.myLabel);
    await expect(moveDelta).toHaveScreenshot("move-delta-my-active.png");

    // The second (best) of MoveDelta's two direct child spans — clicking it
    // switches this row's own active tab to "best" (the same onSelectTab
    // callback the board tests exercise via the my-label click), covering
    // the opposite half of both ternaries without needing to know the
    // exact best-label text (not tracked in DECISIONS above).
    await moveDelta.locator("> span").nth(1).click();
    await expect(moveDelta).toHaveScreenshot("move-delta-best-active.png");
  });

  test("mistakes-section on /matches/[matchId]", async ({ page }) => {
    await mockGameFetches(page);
    await page.goto(`/matches/${MATCH_ID}`);
    await waitForAllGamesLoaded(page);
    await expect(mistakesSection(page)).toHaveScreenshot("mistakes-section-matches.png");
  });

  test("mistakes-section on /galaxy/matches/[matchId]", async ({ page }) => {
    await mockGameFetches(page);
    await page.goto("/galaxy/matches");
    await page.getByRole("button", { name: "Paste authorization" }).click();
    await page.locator("#auth").fill("Bearer visual-test-token");
    await page.getByRole("button", { name: "Connect" }).click();
    await page.getByPlaceholder("Match ID").fill(MATCH_ID);
    await page.getByRole("button", { name: "Jump to match" }).click();
    await page.waitForURL(`**/galaxy/matches/${MATCH_ID}`);
    await waitForAllGamesLoaded(page);
    await expect(mistakesSection(page)).toHaveScreenshot("mistakes-section-galaxy-matches.png");
  });
});
