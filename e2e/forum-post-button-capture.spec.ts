import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

const matchId = "46576635";
const output = path.resolve(__dirname, "../design/screenshots/2026-10-14-forum-post-button");
const fixtures = path.join(__dirname, "fixtures");
const gameFiles = ["match-46576635-game-5.json", "match-46576635-game-6.json", "match-46576635-game-7.json"];
const games = gameFiles.map((file) => JSON.parse(fs.readFileSync(path.join(fixtures, file), "utf8")));
const identities = JSON.parse(fs.readFileSync(path.join(fixtures, "player-identities.json"), "utf8"));
const myLabel = "bar/22 23/20 8/5(2)";
const variants = [
  { width: 390, height: 844, mode: "light" },
  { width: 390, height: 844, mode: "dark" },
  { width: 1280, height: 900, mode: "light" },
  { width: 1280, height: 900, mode: "dark" },
] as const;

async function mockMatch(page: Page) {
  await page.route(`**/api/matches/${matchId}/*`, async (route: Route) => {
    const index = Number(new URL(route.request().url()).pathname.split("/").at(-1));
    const game = Number.isInteger(index) && index >= 1 && index <= games.length ? games[index - 1] : null;
    await route.fulfill({ status: game ? 200 : 404, contentType: "application/json", body: JSON.stringify(game ?? { error: "Not found." }) });
  });
  const decisions = games.flatMap((game: { data: { events: { id: number }[] } }, gameIndex) =>
    game.data.events.map((event) => ({ gameIndex: gameIndex + 1, eventId: String(event.id), dbDecisionId: 1, note: null }))
  );
  await page.route("**/api/player-identities", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(identities) }));
  await page.route("**/api/decision-notes?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ canEdit: false, decisions }) }));
}

test("capture forum post button layouts and draft handoff", async ({ page }) => {
  fs.mkdirSync(output, { recursive: true });
  for (const variant of variants) {
    await page.context().clearCookies();
    await page.context().addCookies([{ name: "bgtheme", value: `clubroom.${variant.mode}`, domain: "localhost", path: "/" }]);
    await page.setViewportSize({ width: variant.width, height: variant.height });

    await page.goto("/mistakes?classification=middle_game&category=checker&severity=error");
    await page.getByText(myLabel, { exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Post to forum" })).toBeVisible();
    await page.screenshot({ path: path.join(output, `mistakes-${variant.width}-${variant.mode}.png`) });

    await mockMatch(page);
    await page.goto(`/matches/${matchId}`);
    await page.locator("#game-select option", { hasText: "Game 3" }).waitFor({ state: "attached" });
    await expect(page.getByRole("button", { name: "Post to forum" }).first()).toBeVisible();
    await page.screenshot({ path: path.join(output, `match-analysis-${variant.width}-${variant.mode}.png`) });

    await mockMatch(page);
    await page.goto(`/matches/${matchId}/replay/6`);
    await expect(page.getByRole("button", { name: "Post to forum" })).toBeVisible();
    await page.screenshot({ path: path.join(output, `replay-${variant.width}-${variant.mode}.png`) });

    await page.goto("/position-builder");
    await expect(page.getByRole("button", { name: "Post to forum" })).toBeVisible();
    await page.screenshot({ path: path.join(output, `position-builder-${variant.width}-${variant.mode}.png`) });

    await page.goto("/forum/new");
    await page.evaluate(() => sessionStorage.setItem("forum-board-handoff", JSON.stringify({
      match: { decisionId: 123 },
      preview: {
        position: { mine: Array(24).fill(0), opponent: Array(24).fill(0), mineBar: 0, opponentBar: 0, mineOff: 0, opponentOff: 0 },
        cube: { kind: "owned", value: 1, owner: "center" }, dice: [6, 4], caption: "5-point match · 1–3 · 6-4 to play",
      },
    })));
    await page.reload();
    await expect(page.getByRole("button", { name: "Remove board" })).toBeVisible();
    await page.screenshot({ path: path.join(output, `forum-new-match-board-${variant.width}-${variant.mode}.png`) });

    await page.goto("/forum/new");
    await page.getByLabel("Title").fill("Draft title");
    await page.getByLabel("Body").fill("Draft body");
    await page.getByRole("link", { name: "Add a board from the position builder" }).click();
    await page.getByRole("button", { name: "Post to forum" }).click();
    await expect(page).toHaveURL(/\/forum\/new$/);
    await expect(page.getByLabel("Title")).toHaveValue("Draft title");
    await expect(page.getByLabel("Body")).toHaveValue("Draft body");
    await expect(page.getByRole("button", { name: "Remove board" })).toBeVisible();
    await page.screenshot({ path: path.join(output, `forum-new-builder-draft-restored-${variant.width}-${variant.mode}.png`) });
  }
});
