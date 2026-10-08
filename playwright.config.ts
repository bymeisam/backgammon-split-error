import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

// Visual regression only — a separate suite/runner from Vitest
// (vitest.config.ts), run via `npm run test:visual`, not part of `npm test`.
// Scoped tightly to e2e/ (see e2e/board-visual.spec.ts): BoardPanel
// screenshots across its three real page call sites, not general page
// coverage. See e2e/README.md for the baseline-update workflow.

// dotenv.parse (not dotenv.config) deliberately — this must NOT mutate
// process.env; it's read into a plain object and passed only to the
// dedicated webServer entry's own `env` below.
const testDbEnv = dotenv.parse(fs.readFileSync(path.resolve(__dirname, ".env.test")));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // 2 everywhere, not just CI: measured that headless Chromium's rendering
  // of some diagonal-arrow board states isn't fully deterministic between
  // process runs even with --disable-gpu below (~1% pixel jitter, never
  // twice in a row for the same test in repeated local testing) — the
  // standard mitigation for this exact class of noise. maxDiffPixelRatio
  // stays 0 (see below) rather than widening the tolerance instead: a real
  // regression fails the same way on every retry, this jitter doesn't, so
  // retries catch the real/noise distinction that a looser pixel tolerance
  // can't (a real single-arrow bug measured the same ~1% magnitude).
  retries: 2,
  reporter: [["list"]],
  use: {
    // :3100, not :3000 — a dedicated server (see webServer below), never
    // the real dev server. All 12 tests run against it: the 8
    // /matches-/galaxy-matches ones don't care (their fetches are fully
    // mocked, so which server/DB serves the page shell is irrelevant), and
    // the 4 /mistakes ones need it specifically (DATABASE_URL pointed at
    // the seeded bg_test schema instead of whatever the real .env has).
    baseURL: "http://localhost:3100",
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 1,
    trace: "retain-on-failure",
  },
  expect: {
    // maxDiffPixelRatio/maxDiffPixels deliberately left at 0: measured that
    // a real one-arrow-path regression (a wrong move drawn) only touches
    // ~1% of this image's pixels, the same order of magnitude as GPU
    // compositor anti-aliasing jitter on diagonal SVG lines between runs of
    // byte-identical data — any pixel-count allowance big enough to absorb
    // that noise would also hide that class of real bug. Fixed the noise at
    // its source instead (--disable-gpu below), not by loosening the
    // comparison.
    //
    // stylePath: the navbar is sticky, so it would cover the top of an
    // element screenshot after Playwright scrolls the element into view.
    // e2e/screenshot.css makes it static during the screenshot only (no
    // layout change: a sticky element keeps its place in the flow).
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0, stylePath: "e2e/screenshot.css" },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Headless Chromium's GPU-compositor path rasterizes diagonal SVG
        // lines with a few px of run-to-run jitter even for byte-identical
        // markup (measured: ~1% of the board-panel image, on the same
        // order of magnitude as a real one-arrow regression — see above).
        // Software rendering is deterministic, which is why this is here
        // instead of a looser pixel tolerance.
        launchOptions: { args: ["--disable-gpu"] },
      },
    },
  ],
  // One dedicated server, port 3100, DATABASE_URL/DATABASE_URL_READONLY
  // overridden to the seeded bg_test schema (.env.test, e2e/README.md,
  // e2e/seed-test-db.ts) — never the real .env's values, and never the
  // real dev server on :3000 (a second `next dev` for the same project
  // can't share that one anyway — it refuses to start a second instance
  // against the same .next build dir). The 8 /matches-/galaxy-matches
  // tests run against this same server too — harmless, since their
  // fetches are all mocked via page.route() (see board-visual.spec.ts), so
  // which DB the server is connected to never actually matters to them;
  // only /mistakes (a server component querying Prisma directly) needs
  // bg_test specifically. NEXT_DIST_DIR (see next.config.ts) points this
  // instance at its own .next-test build dir, since a second `next dev`
  // for the same project otherwise refuses to start (a lock file inside
  // distDir) regardless of port.
  webServer: {
    command: "npm run dev -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
    // DISABLE_DEV_INDICATOR (read by next.config.ts) turns off Next's
    // bottom-left dev-tools overlay for this server only — it was
    // intermittently landing inside a BoardPanel screenshot's clipped
    // region and failing the pixel-diff (see PROGRESS.md), unrelated to
    // any real content change. The normal :3000 dev server never sets
    // this, so the overlay stays on there — it's a genuinely useful
    // indicator for actual local development, just noise for a
    // screenshot-diffing test server.
    //
    // ENABLE_WRITE_MODE is pinned to "true" here (after the .env.test
    // spread, so it always wins) so isGalaxyEnabled() is on for this server
    // regardless of what .env/.env.test say: decision-card-chromium-darwin.png
    // is captured with DecisionNote's editable textarea, which only renders
    // when write mode is on. The other half of isGalaxyEnabled(),
    // DATABASE_URL, comes from .env.test (bg_test). Writes from this server
    // can only reach bg_test, and the suite itself never saves a note.
    env: {
      ...testDbEnv,
      ENABLE_WRITE_MODE: "true",
      NEXT_DIST_DIR: ".next-test",
      DISABLE_DEV_INDICATOR: "1",
    },
  },
});
