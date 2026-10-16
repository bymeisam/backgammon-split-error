// The types the shot modules share, and the page helpers they all use.
import type { Page } from "@playwright/test";
import { BASE_URL, REPLAY } from "./config";

export type Theme = "light" | "dark";
export interface Variant {
  width: 1440 | 1280 | 1024 | 768 | 390;
  theme: Theme;
}
export interface ShotContext {
  page: Page;
  variant: Variant;
  shoot: (name: string, mode: "full" | "viewport") => Promise<void>;
}
export interface Shot {
  name: string;
  // Width-only shots (e.g. the 390 sheet).
  only?: Variant["width"];
  run: (ctx: ShotContext) => Promise<void>;
}

export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

export async function open(page: Page, url: string): Promise<void> {
  // Generous: a cold /mistakes query can take a while on the full local DB.
  await page.goto(`${BASE_URL}${url}`, { waitUntil: "networkidle", timeout: 120_000 });
  await settle(page);
}

export async function openReplay(page: Page, move: number): Promise<void> {
  await open(page, REPLAY);
  await page.getByText(/Move 1 of \d+/).first().waitFor();
  for (let i = 1; i < move; i++) await page.keyboard.press("ArrowDown");
  await page.getByText(new RegExp(`Move ${move} of \\d+`)).first().waitFor();
  await settle(page);
}

export async function openMenuIfNarrow(ctx: ShotContext): Promise<void> {
  if (ctx.variant.width !== 390) return;
  await ctx.page.getByRole("button", { name: "Menu" }).click();
  await ctx.page.waitForTimeout(200);
}
