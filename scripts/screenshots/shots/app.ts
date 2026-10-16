// The default set's shots (and the review set's one, the session).
import { BASE_URL, MATCH, REPLAY_CHECKER_CUBE_OWNED, REPLAY_CHECKER_ERROR, REPLAY_CUBE_TAKE } from "../config";
import { open, openMenuIfNarrow, openReplay, settle, type Shot, type ShotContext } from "../helpers";

interface QueueOption {
  key: string;
  correct: boolean;
}
interface QueueResponse {
  cards: { cardId: number; bestKey: string; options: QueueOption[]; decision?: { note: string | null } }[];
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
  page.on("response", (response) => {
    if (response.url().includes("/api/review/queue")) {
      console.log(`review queue response: ${response.status()} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("/api/review/queue")) {
      console.log(`review queue request failed: ${request.failure()?.errorText ?? "unknown"}`);
    }
  });

  const queueResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/review/queue" && response.request().method() === "GET" && response.status() === 200;
  }, { timeout: 30_000 });
  await page.goto(`${BASE_URL}/review`, { waitUntil: "domcontentloaded" });
  const queue = (await (await queueResponse).json()) as QueueResponse;
  await page.getByTestId("review-header").waitFor();
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
    await page.locator(`[data-option-key="${option.key.replace(/"/g, '\\"')}"]`).click();
    let finalOption = option;
    if (option.correct && card.decision?.note) {
      await page.getByRole("heading", { name: "Do you know the reason?" }).waitFor();
      await settle(page);
      const no = page.getByRole("button", { name: "No" });
      await no.focus();
      await page.keyboard.press("Shift+Tab");
      await shoot(`review-${step.label}-reason-yes-focus`, "viewport");
      await page.keyboard.press("Tab");
      await shoot(`review-${step.label}-reason-no-focus`, "viewport");
      await no.click();
    } else if (!option.correct && card.decision?.note && card.options.length !== 2) {
      await page.getByText("Try again. Your first choice is crossed out.").waitFor();
      await settle(page);
      await shoot(`review-${step.label}-retry-front`, "viewport");
      const retryOption = card.options.find((o) => o.correct && o.key !== option.key);
      if (retryOption) {
        finalOption = retryOption;
        await page.locator(`[data-option-key="${retryOption.key.replace(/"/g, '\\"')}"]`).click();
      }
    }
    await page.getByTestId("review-verdict").waitFor();
    if (!finalOption.correct) await page.getByText("Recorded as Again ·").waitFor();
    await settle(page);
    const verdict = finalOption.correct ? "correct" : "incorrect";
    await shoot(`review-${step.label}-back-${verdict}`, "viewport");
    await shoot(`review-${step.label}-back-${verdict}`, "full");
    if (option.correct && card.decision?.note) {
      await shoot("review-hard-good-back", "viewport");
      await shoot("review-hard-good-back", "full");
    }
    // Checker backs have Yours / Best tabs under the board (Best is the
    // default, shot above); h switches to Yours. Cube backs have none, and
    // neither does a back whose answer is the best (one "Yours [Best]" chip).
    const tabs = page.getByRole("tablist", { name: "Move shown on the board" });
    if (await tabs.isVisible()) {
      await page.keyboard.press("h");
      await page.waitForTimeout(200);
      await shoot(`review-${step.label}-back-${verdict}-yours`, "viewport");
    }
    if (finalOption.correct) {
      const rateButton = card.decision?.note && !option.correct ? "Hard" : "Good";
      await page.getByRole("button", { name: rateButton }).click();
      if (card.decision?.note && !option.correct) {
        await page.getByRole("button", { name: "Next card" }).waitFor();
        await page.getByRole("button", { name: "Next card" }).click();
      }
    } else await page.getByRole("button", { name: "Next" }).click();
    await page.waitForTimeout(300);
  }
  const noted = queue.cards.find((card) => card.decision?.note && card.options.length > 2);
  if (noted) {
    const refreshed = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/review/queue" && response.request().method() === "GET" && response.status() === 200;
    }, { timeout: 30_000 });
    await page.goto(`${BASE_URL}/review`, { waitUntil: "domcontentloaded" });
    await refreshed;
    await page.locator(`[data-testid="review-question"][data-card-id="${noted.cardId}"]`).waitFor();
    const wrong = noted.options.find((option) => !option.correct);
    const retryRight = noted.options.find((option) => option.correct && option.key !== wrong?.key);
    if (wrong && retryRight) {
      await page.locator(`[data-option-key="${wrong.key.replace(/"/g, '\\"')}"]`).click();
      await page.getByText("Try again. Your first choice is crossed out.").waitFor();
      await settle(page);
      await shoot("review-retry-front", "viewport");
      await page.locator(`[data-option-key="${retryRight.key.replace(/"/g, '\\"')}"]`).click();
      await page.getByTestId("review-verdict").waitFor();
      await settle(page);
      await shoot("review-second-try-right-back", "viewport");
      await shoot("review-hard-only-back", "viewport");
      await shoot("review-hard-only-back", "full");
      await page.getByRole("button", { name: "Hard" }).click();
      await page.mouse.move(0, 0);
      const nextCard = page.getByRole("button", { name: "Next card" });
      await nextCard.waitFor({ state: "visible" });
      await page.waitForFunction(() => {
        const button = [...document.querySelectorAll("button")].find((element) => element.textContent?.includes("Next card"));
        return button instanceof HTMLButtonElement && !button.disabled;
      });
      await settle(page);
      await page.evaluate(() => window.scrollBy(0, 100));
      await settle(page);
      await shoot("review-hard-only-saved", "viewport");
    }
  }
  await settle(page);
  if (await page.getByTestId("review-summary").isVisible()) await shoot("review-summary", "full");
}

export const SHOTS: Shot[] = [
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
