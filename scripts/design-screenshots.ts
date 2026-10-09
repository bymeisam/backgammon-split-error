// Screenshots of every main page for the designer agent
// (.claude/agents/designer.md), at 1440 px and 390 px wide, in light and
// dark (Playwright's colorScheme emulation); since 2026-10-09 /sources
// (with its token prompt) and /sources/galaxy/matches too. Written to
// design/screenshots/<YYYY-MM-DD>/ (gitignored).
//
// It only talks HTTP to an already-running app; it never connects to a
// database itself. Start one first, against the LOCAL database, with write
// mode on (the review pages and the navbar's write-mode items need it):
//
//   npm run build && ENABLE_WRITE_MODE=true npx next start -p 3300
//   npx tsx scripts/design-screenshots.ts
//
// Navbar shots (since 2026-10-09): at 768, 1024, 1280 and 1440, light and
// dark, the top of /matches, the open Menu at 768, and the Review › Cards
// dropdown at 1024, 1280 and 1440 (the row, from lg). Each one also
// measures the bar (scrollWidth against clientWidth, the slack: the free
// space left in the row, and from lg the width the row needs; whether the
// "Game Review" wordmark and the Menu button show) and prints a
// table, written to nav-metrics-<write|readonly>.json too. The
// file names carry the server's mode (nav-write-… / nav-readonly-…), read
// from the page's mode badge. For the read-only shots start a second
// server with write mode off on the command line only, and pass
// --nav-only:
//
//   ENABLE_WRITE_MODE=false npx next start -p 3301
//   npx tsx scripts/design-screenshots.ts --base-url=http://localhost:3301 --nav-only
//
// Options:
//   --base-url=<url>          default http://localhost:3300
//   --nav-only                only the navbar shots (no review cards are
//                             added, so it works on a read-only server)
//   --date=<YYYY-MM-DD>       output folder name; default today (local time)
//   --theme=<id>              a theme from lib/themes.ts (e.g. quiet-ink),
//                             set the way /settings sets it: the bgtheme
//                             cookie, "<id>.system", so the server renders
//                             it and the light/dark emulation picks the
//                             mode. The shots then go to
//                             design/screenshots/<date>/<id>/. Without it
//                             no cookie is set and the app's own default
//                             is shot, into design/screenshots/<date>/.
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
// order they were added): card 1 answered with the best option, card 2
// answered wrong, card 3 (if any) answered right but not best (a Good
// answer) when it has such an option, else right.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { isThemeId, serializeThemeCookie, THEME_COOKIE, THEMES } from "../lib/themes";

type Theme = "light" | "dark";
interface Variant {
  width: 1440 | 1280 | 1024 | 768 | 390;
  theme: Theme;
}
interface ShotContext {
  page: Page;
  variant: Variant;
  shoot: (name: string, mode: "full" | "viewport") => Promise<void>;
}
interface Shot {
  name: string;
  // Width-only shots (e.g. the 390 sheet).
  only?: Variant["width"];
  run: (ctx: ShotContext) => Promise<void>;
}
interface QueueOption {
  key: string;
  correct: boolean;
}
interface QueueResponse {
  cards: { cardId: number; bestKey: string; options: QueueOption[] }[];
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
const NAV_ONLY = process.argv.includes("--nav-only");
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

// The navbar shots' widths: the Menu panel at 768 (md itself), the full
// row at 1024 (lg itself, the tightest row, with the wordmark hidden), 1280
// (xl, the wordmark back) and 1440.
const NAV_VARIANTS: Variant[] = ([768, 1024, 1280, 1440] as const).flatMap((width) =>
  (["light", "dark"] as const).map((theme) => ({ width, theme }))
);

// The data the pages show: real local matches used throughout PROGRESS.md.
const MATCH = "47816592";
const REPLAY = "/matches/45282503/replay/2";
// Replay steps ("Move N of 25"), reached with the replay's own ↓ key (→
// until the keyboard batch of 2026-10-09 made ←/→ the Played/Best tabs).
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
  for (let i = 1; i < move; i++) await page.keyboard.press("ArrowDown");
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

  const plan: { label: string; want: "best" | "wrong" | "good" }[] = [
    { label: "card1", want: "best" },
    { label: "card2", want: "wrong" },
    { label: "card3", want: "good" },
  ];
  for (const [i, step] of plan.entries()) {
    const card = queue.cards[i];
    if (!card) break;
    await page.locator(`[data-testid="review-question"][data-card-id="${card.cardId}"]`).waitFor();
    await settle(page);
    await shoot(`review-${step.label}-front`, "viewport");
    const option =
      (step.want === "best" && card.options.find((o) => o.key === card.bestKey)) ||
      (step.want === "good" && card.options.find((o) => o.correct && o.key !== card.bestKey)) ||
      card.options.find((o) => o.correct === (step.want !== "wrong")) ||
      card.options[0];
    const kind = option.key === card.bestKey ? "best" : option.correct ? "good" : "wrong";
    console.log(`review: ${step.label} answered ${kind} (${option.key})`);
    await page.locator(`[data-option-key="${option.key.replace(/"/g, '\\"')}"]`).click();
    await page.getByTestId("review-verdict").waitFor();
    if (!option.correct) await page.getByText("Recorded as Again ·").waitFor();
    await settle(page);
    const verdict = option.correct ? "correct" : "incorrect";
    await shoot(`review-${step.label}-back-${verdict}`, "viewport");
    await shoot(`review-${step.label}-back-${verdict}`, "full");
    // Checker backs have Yours / Best tabs under the board (Best is the
    // default, shot above); h switches to Yours. Cube backs have none, and
    // neither does a back whose answer is the best (one "Yours · Best"
    // chip).
    const tabs = page.getByRole("tablist", { name: "Move shown on the board" });
    if (await tabs.isVisible()) {
      await page.keyboard.press("h");
      await page.waitForTimeout(200);
      await shoot(`review-${step.label}-back-${verdict}-yours`, "viewport");
    }
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
    name: "sources",
    run: async ({ page, shoot }) => {
      await open(page, "/sources");
      await shoot("sources", "full");
      // No token in a fresh browser: "Add token" opens the token prompt.
      await page.getByRole("button", { name: "Add token" }).click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(200);
      await shoot("sources-add-token", "viewport");
    },
  },
  {
    name: "sources-galaxy-matches",
    run: async ({ page, shoot }) => {
      // Without a token the page is its blocking token prompt over the
      // header (breadcrumbs Sources › Galaxy › Matches).
      await open(page, "/sources/galaxy/matches");
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(200);
      await shoot("sources-galaxy-matches", "viewport");
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
    name: "settings",
    run: async ({ page, shoot }) => {
      await open(page, "/settings");
      await shoot("settings", "full");
    },
  },
  {
    name: "shortcuts-help",
    run: async (ctx) => {
      await openReplay(ctx.page, REPLAY_CHECKER_ERROR);
      // Below lg the "?" button is inside the collapsed menu.
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

// One measurement of the bar, at one width/theme/mode.
interface NavMetric {
  width: number;
  theme: Theme;
  mode: "write" | "readonly";
  // The bar's inner row: scrollWidth − clientWidth (0 = nothing overflows).
  overflow: number;
  // The menu row itself (from lg): scrollWidth − clientWidth.
  menuOverflow: number;
  // Free space left in the row. From lg: the gap between the links and the
  // end group, minus the guaranteed 32px. Below lg: the gap between the
  // brand and the mode badge + Menu, minus the row's 12px gap.
  slack: number;
  // From lg: the px between the last link and the mode badge (≥ 32).
  linkToEnd: number | null;
  // From lg: the narrowest bar the full row fits in with its 32px gap (the
  // bar's width minus the slack). The bar is the viewport up to 1240px, so
  // this is the smallest viewport the row could take before the Menu.
  rowNeeds: number | null;
  // The end group's height (one line is the 30px buttons).
  endHeight: number;
  // Whether the "Game Review" wordmark is visible (sr-only from lg to xl)
  // and whether the Menu button shows (below lg only).
  wordmark: boolean;
  menuButton: boolean;
}

async function navMode(page: Page): Promise<"write" | "readonly"> {
  return (await page.locator('[data-app-nav] [title^="Read-only"]').count()) > 0 ? "readonly" : "write";
}

async function measureNav(page: Page, variant: Variant, mode: NavMetric["mode"]): Promise<NavMetric> {
  // A string, not a function: tsx's __name helper breaks a function passed
  // into the page (the same reason the Phase 2 init script was a string).
  const m = (await page.evaluate(`(() => {
    const inner = document.querySelector("[data-app-nav] > div");
    const menu = document.getElementById("app-nav-menu");
    const list = menu.children[0];
    const end = menu.children[1];
    const brand = inner.children[0];
    const narrowEnd = inner.children[1];
    const wide = getComputedStyle(narrowEnd).display === "none";
    const linkToEnd = wide ? end.getBoundingClientRect().left - list.getBoundingClientRect().right : null;
    const wordmark = brand.querySelector("span");
    return {
      overflow: inner.scrollWidth - inner.clientWidth,
      menuOverflow: wide ? menu.scrollWidth - menu.clientWidth : 0,
      slack: wide
        ? linkToEnd - 32
        : narrowEnd.getBoundingClientRect().left - brand.getBoundingClientRect().right - 12,
      linkToEnd,
      rowNeeds: wide ? inner.getBoundingClientRect().width - (linkToEnd - 32) : null,
      endHeight: wide ? Math.round(end.getBoundingClientRect().height) : 0,
      wordmark: !!wordmark && wordmark.getBoundingClientRect().width > 1,
      menuButton: !wide,
    };
  })()`)) as Omit<NavMetric, "width" | "theme" | "mode">;
  return {
    width: variant.width,
    theme: variant.theme,
    mode,
    ...m,
    slack: Math.round(m.slack * 10) / 10,
    rowNeeds: m.rowNeeds === null ? null : Math.round(m.rowNeeds * 10) / 10,
  };
}

// The navbar pass: see the header. Returns one metric per variant.
async function navShots(
  browser: Browser,
  addTheme: (ctx: BrowserContext) => Promise<void>,
  written: string[],
  failures: string[]
): Promise<NavMetric[]> {
  const metrics: NavMetric[] = [];
  for (const variant of NAV_VARIANTS) {
    const context = await browser.newContext({
      viewport: { width: variant.width, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: variant.theme,
    });
    await addTheme(context);
    const page = await context.newPage();
    const shoot = async (name: string) => {
      const file = `${name}--${variant.width}-${variant.theme}--viewport.png`;
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      written.push(file);
    };
    try {
      await open(page, "/matches");
      const mode = await navMode(page);
      metrics.push(await measureNav(page, variant, mode));
      await shoot(`nav-${mode}-top`);
      if (variant.width < 1024) {
        await page.getByRole("button", { name: "Menu" }).click();
        await page.waitForTimeout(200);
        await shoot(`nav-${mode}-menu-open`);
      } else {
        await page.locator("#app-nav-menu").getByRole("link", { name: /^Review/ }).hover();
        await page.locator("#app-nav-menu").getByRole("link", { name: "Cards" }).waitFor({ state: "visible" });
        await page.waitForTimeout(200);
        await shoot(`nav-${mode}-review-dropdown`);
      }
    } catch (err) {
      failures.push(`nav @ ${variant.width}-${variant.theme}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    } finally {
      await context.close();
    }
  }
  return metrics;
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
  // The theme as the app stores it: the bgtheme cookie, in system mode so
  // the colorScheme emulation picks light or dark.
  const addTheme = async (context: BrowserContext) => {
    if (THEME && isThemeId(THEME)) {
      await context.addCookies([
        { name: THEME_COOKIE, value: serializeThemeCookie({ theme: THEME, mode: "system" }), url: BASE_URL },
      ]);
    }
  };
  let metrics: NavMetric[] = [];
  try {
    if (!NAV_ONLY) await addReviewCards(created);
    browser = await chromium.launch({ args: ["--disable-gpu"] });
    metrics = await navShots(browser, addTheme, written, failures);
    for (const variant of NAV_ONLY ? [] : VARIANTS) {
      const context = await browser.newContext({
        viewport: { width: variant.width, height: variant.width === 1440 ? 900 : 844 },
        deviceScaleFactor: variant.width === 390 ? 2 : 1,
        colorScheme: variant.theme,
      });
      await addTheme(context);
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

  if (metrics.length) {
    console.log("nav: width theme mode | overflow menuOverflow | slack linkToEnd rowNeeds | endHeight | wordmark menuButton");
    for (const m of metrics) {
      console.log(
        `nav: ${m.width} ${m.theme} ${m.mode} | ${m.overflow} ${m.menuOverflow} | ${m.slack} ${m.linkToEnd ?? "-"} ${m.rowNeeds ?? "-"} | ${m.endHeight} | ${m.wordmark} ${m.menuButton}`
      );
    }
    writeFileSync(path.join(OUT_DIR, `nav-metrics-${metrics[0].mode}.json`), JSON.stringify(metrics, null, 2));
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
