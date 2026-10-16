// The navbar pass (see the header of index.ts): shots and measurements.
import path from "node:path";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { NAV_VARIANTS, OUT_DIR } from "./config";
import { open, type Theme, type Variant } from "./helpers";

// One measurement of the bar, at one width/theme/mode.
export interface NavMetric {
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

export async function navMode(page: Page): Promise<"write" | "readonly"> {
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
export async function navShots(
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
