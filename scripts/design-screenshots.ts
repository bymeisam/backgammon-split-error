// Screenshots of every main page for the designer agent
// (.claude/agents/designer.md), at 1440 px and 390 px wide, in light and
// dark (Playwright's colorScheme emulation). Written to
// design/screenshots/<YYYY-MM-DD>/ (gitignored).
//
// It only talks HTTP to an already-running app; it never connects to a
// database itself. Start one first, against the LOCAL database, with write
// mode on (the review pages and the navbar's write-mode items need it):
//
//   npm run build && ENABLE_WRITE_MODE=true npx next start -p 3300
//   npx tsx scripts/design-screenshots.ts
//
// Options:
//   --base-url=<url>          default http://localhost:3300
//   --date=<YYYY-MM-DD>       output folder name; default today (local time)
//   --theme=<id>              a theme from lib/themes.ts (e.g. quiet-ink),
//                             set as data-theme on <html> in the browser
//                             before every page's own scripts run (there's
//                             no user-facing switch yet). The shots then go
//                             to design/screenshots/<date>/<id>/. Without
//                             it the app's own default is shot, into
//                             design/screenshots/<date>/.
//   --review-decisions=a,b,c  Decision ids to put into review for the /review
//                             shots. Each is added with POST /api/review/cards
//                             before the shots and removed with
//                             DELETE /api/review/cards/<id> afterwards (also
//                             when a shot fails). A decision already in review
//                             is used but left alone. Answers in the session
//                             are never saved: the answer POST is answered by
//                             a stub inside the browser, so no ReviewLog rows
//                             are written.
//
// The review session's shots take the cards in queue order (new cards in the
// order they were added): card 1 answered right, card 2 answered wrong,
// card 3 (if any) answered right.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import { isThemeId, THEMES } from "../lib/themes";

type Theme = "light" | "dark";
interface Variant {
  width: 1440 | 390;
  theme: Theme;
}
interface ShotContext {
  page: Page;
  variant: Variant;
  shoot: (name: string, mode: "full" | "viewport") => Promise<void>;
}
interface Shot {
  name: string;
  // Narrow-screen-only shots (the Menu button only exists below md).
  only?: 390 | 1440;
  run: (ctx: ShotContext) => Promise<void>;
}
interface QueueOption {
  key: string;
  correct: boolean;
}
interface QueueResponse {
  cards: { cardId: number; options: QueueOption[] }[];
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const BASE_URL = (arg("base-url") ?? "http://localhost:3300").replace(/\/$/, "");
const DATE = arg("date") ?? today();
const THEME = arg("theme");
if (THEME !== undefined && !isThemeId(THEME)) {
  console.error(`Unknown --theme=${THEME}; known: ${THEMES.map((t) => t.id).join(", ")}`);
  process.exit(1);
}
const OUT_DIR = path.resolve(process.cwd(), "design", "screenshots", DATE, ...(THEME ? [THEME] : []));
const REVIEW_DECISIONS = (arg("review-decisions") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);

const VARIANTS: Variant[] = [
  { width: 1440, theme: "light" },
  { width: 1440, theme: "dark" },
  { width: 390, theme: "light" },
  { width: 390, theme: "dark" },
];

// The data the pages show: real local matches used throughout PROGRESS.md.
const MATCH = "47816592";
const REPLAY = "/matches/45282503/replay/2";
// Replay steps ("Move N of 25"), reached with the replay's own → key.
const REPLAY_CHECKER_ERROR = 2; // a checker error
const REPLAY_CHECKER_CUBE_OWNED = 15; // a checker play, the opponent owns the 2-cube
const REPLAY_CUBE_TAKE = 16; // "Opponent redoubles to 4: you took"

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

async function open(page: Page, url: string): Promise<void> {
  // Generous: a cold /mistakes query can take a while on the full local DB.
  await page.goto(`${BASE_URL}${url}`, { waitUntil: "networkidle", timeout: 120_000 });
  await settle(page);
}

async function openReplay(page: Page, move: number): Promise<void> {
  await open(page, REPLAY);
  await page.getByText(/Move 1 of \d+/).first().waitFor();
  for (let i = 1; i < move; i++) await page.keyboard.press("ArrowRight");
  await page.getByText(new RegExp(`Move ${move} of \\d+`)).first().waitFor();
  await settle(page);
}

async function openMenuIfNarrow(ctx: ShotContext): Promise<void> {
  if (ctx.variant.width !== 390) return;
  await ctx.page.getByRole("button", { name: "Menu" }).click();
  await ctx.page.waitForTimeout(200);
}

// The /review session: answers are stubbed (see the header), so nothing is
// saved. Picks a right or wrong option from the queue response itself.
async function reviewSession(ctx: ShotContext): Promise<void> {
  const { page, shoot } = ctx;
  await page.route("**/api/review/cards/*/answer", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as { rating?: string | null };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        correct: body.rating != null,
        rating: body.rating ?? "again",
        loss: 0,
        due: new Date(Date.now() + 86_400_000).toISOString(),
        state: 1,
      }),
    });
  });

  const queueResponse = page.waitForResponse((r) => r.url().includes("/api/review/queue"));
  await page.goto(`${BASE_URL}/review`, { waitUntil: "networkidle" });
  const queue = (await (await queueResponse).json()) as QueueResponse;
  await settle(page);
  if (queue.cards.length === 0) {
    await shoot("review-empty", "full");
    return;
  }

  const plan: { label: string; correct: boolean }[] = [
    { label: "card1", correct: true },
    { label: "card2", correct: false },
    { label: "card3", correct: true },
  ];
  for (const [i, step] of plan.entries()) {
    const card = queue.cards[i];
    if (!card) break;
    await page.locator(`[data-testid="review-question"][data-card-id="${card.cardId}"]`).waitFor();
    await settle(page);
    await shoot(`review-${step.label}-front`, "viewport");
    const option = card.options.find((o) => o.correct === step.correct) ?? card.options[0];
    await page.locator(`[data-option-key="${option.key.replace(/"/g, '\\"')}"]`).click();
    await page.getByTestId("review-verdict").waitFor();
    if (!option.correct) await page.getByText("Recorded as Again ·").waitFor();
    await settle(page);
    const verdict = option.correct ? "correct" : "incorrect";
    await shoot(`review-${step.label}-back-${verdict}`, "viewport");
    await shoot(`review-${step.label}-back-${verdict}`, "full");
    // On to the next card: rate Good (right) or Next (wrong); both stubbed.
    if (option.correct) await page.getByRole("button", { name: "Good" }).click();
    else await page.getByRole("button", { name: "Next" }).click();
    await page.waitForTimeout(300);
  }
  await settle(page);
  if (await page.getByTestId("review-summary").isVisible()) await shoot("review-summary", "full");
}

const SHOTS: Shot[] = [
  {
    name: "dashboard",
    run: async ({ page, shoot }) => {
      await open(page, "/");
      await shoot("dashboard", "full");
    },
  },
  {
    name: "matches",
    run: async ({ page, shoot }) => {
      await open(page, "/matches");
      await shoot("matches-list", "full");
    },
  },
  {
    name: "match-detail",
    run: async ({ page, shoot }) => {
      await open(page, `/matches/${MATCH}`);
      await shoot(`match-detail-${MATCH}`, "viewport");
      await shoot(`match-detail-${MATCH}`, "full");
    },
  },
  {
    name: "replay",
    run: async ({ page, shoot }) => {
      await openReplay(page, REPLAY_CHECKER_ERROR);
      await shoot("replay-checker-error-move2", "viewport");
      await shoot("replay-checker-error-move2", "full");
      await openReplay(page, REPLAY_CHECKER_CUBE_OWNED);
      await shoot("replay-checker-with-cube-move15", "viewport");
      await openReplay(page, REPLAY_CUBE_TAKE);
      await page.getByTestId("double-offer-label").waitFor();
      await shoot("replay-cube-take-move16", "viewport");
      await shoot("replay-cube-take-move16", "full");
    },
  },
  {
    name: "matches-analysis",
    run: async ({ page, shoot }) => {
      await open(page, "/matches/analysis");
      await shoot("matches-analysis", "full");
    },
  },
  {
    name: "mistakes",
    run: async ({ page, shoot }) => {
      await open(page, "/mistakes?category=checker&severity=blunder");
      await shoot("mistakes-checker-blunders", "viewport");
      await shoot("mistakes-checker-blunders", "full");
    },
  },
  {
    name: "repeated-positions",
    run: async ({ page, shoot }) => {
      // Unfiltered, the page only asks for a filter; blunders lists positions.
      await open(page, "/repeated-positions");
      await shoot("repeated-positions-unfiltered", "viewport");
      await open(page, "/repeated-positions?severity=blunder");
      await shoot("repeated-positions-blunders", "full");
      const first = page.locator('a[href*="positionId="]').first();
      if (await first.count()) {
        await first.click();
        await page.waitForURL(/positionId=/);
        await settle(page);
        await shoot("repeated-positions-blunders-drilldown", "viewport");
        await shoot("repeated-positions-blunders-drilldown", "full");
      }
    },
  },
  { name: "review", run: reviewSession },
  {
    name: "review-cards",
    run: async ({ page, shoot }) => {
      await open(page, "/review/cards");
      await shoot("review-cards", "full");
    },
  },
  {
    name: "status",
    run: async ({ page, shoot }) => {
      await open(page, "/status");
      await shoot("status", "full");
    },
  },
  {
    name: "shortcuts-help",
    run: async (ctx) => {
      await openReplay(ctx.page, REPLAY_CHECKER_ERROR);
      // Below md the "?" button is inside the collapsed menu.
      await openMenuIfNarrow(ctx);
      await ctx.page.getByRole("button", { name: "Keyboard shortcuts" }).click();
      await ctx.page.getByTestId("shortcuts-help").waitFor();
      await ctx.page.waitForTimeout(200);
      await ctx.shoot("shortcuts-help-open-replay", "viewport");
    },
  },
  {
    name: "nav-menu",
    only: 390,
    run: async (ctx) => {
      await open(ctx.page, "/matches");
      await openMenuIfNarrow(ctx);
      await ctx.shoot("nav-menu-open", "viewport");
    },
  },
];

function themeInitScript(theme: string): string {
  return `(() => {
    const theme = ${JSON.stringify(theme)};
    const apply = () => {
      const html = document.documentElement;
      if (html && html.getAttribute("data-theme") !== theme) html.setAttribute("data-theme", theme);
    };
    apply();
    new MutationObserver(apply).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  })();`;
}

// Pushes each new card id into `created` as soon as it exists, so a failure
// part-way still lets the caller remove the ones already added.
async function addReviewCards(created: number[]): Promise<void> {
  for (const decisionId of REVIEW_DECISIONS) {
    const res = await fetch(`${BASE_URL}/api/review/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisionId }),
    });
    const json = (await res.json().catch(() => null)) as { cardId?: number; error?: string } | null;
    if (res.status === 201 && json?.cardId) {
      created.push(json.cardId);
      console.log(`review: added decision ${decisionId} as card ${json.cardId}`);
    } else if (res.status === 409) {
      console.log(`review: decision ${decisionId} is already in review; using it, not removing it`);
    } else {
      throw new Error(`Adding decision ${decisionId} to review failed: HTTP ${res.status} ${json?.error ?? ""}`);
    }
  }
}

async function removeReviewCards(cardIds: number[]): Promise<void> {
  for (const id of cardIds) {
    const res = await fetch(`${BASE_URL}/api/review/cards/${id}`, { method: "DELETE" });
    console.log(`review: removed card ${id} (HTTP ${res.status})`);
    if (!res.ok) process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(
    `Screenshots of ${BASE_URL}${THEME ? ` (theme ${THEME})` : ""} → ${path.relative(process.cwd(), OUT_DIR)}/`
  );

  let browser: Browser | null = null;
  const created: number[] = [];
  const written: string[] = [];
  const failures: string[] = [];
  try {
    await addReviewCards(created);
    browser = await chromium.launch({ args: ["--disable-gpu"] });
    for (const variant of VARIANTS) {
      const context = await browser.newContext({
        viewport: { width: variant.width, height: variant.width === 1440 ? 900 : 844 },
        deviceScaleFactor: variant.width === 390 ? 2 : 1,
        colorScheme: variant.theme,
      });
      // The theme on <html>, before the page's scripts, and again if
      // anything resets it (React's hydration of <html>, a client
      // navigation). A string, not a function: tsx compiles functions with
      // esbuild's __name helper, which doesn't exist in the page.
      if (THEME) await context.addInitScript({ content: themeInitScript(THEME) });
      for (const shot of SHOTS) {
        if (shot.only && shot.only !== variant.width) continue;
        const page = await context.newPage();
        const shoot = async (name: string, mode: "full" | "viewport") => {
          const file = `${name}--${variant.width}-${variant.theme}--${mode}.png`;
          await page.screenshot({ path: path.join(OUT_DIR, file), fullPage: mode === "full" });
          written.push(file);
        };
        try {
          await shot.run({ page, variant, shoot });
        } catch (err) {
          failures.push(`${shot.name} @ ${variant.width}-${variant.theme}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
        } finally {
          await page.close();
        }
      }
      await context.close();
    }
  } finally {
    await browser?.close();
    await removeReviewCards(created);
  }

  console.log(`${written.length} screenshots written.`);
  if (failures.length) {
    console.error(`${failures.length} shot(s) failed:\n  ${failures.join("\n  ")}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
