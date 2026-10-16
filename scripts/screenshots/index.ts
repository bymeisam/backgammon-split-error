// Screenshots of every main page for the designer agent
// (.claude/agents/designer.md), at 1440 px and 390 px wide, in light and
// dark (Playwright's colorScheme emulation); since 2026-10-09 /sources
// (with its token prompt) and /sources/galaxy/matches too. Written to
// design/screenshots/<YYYY-MM-DD>/ (gitignored).
//
// Usage (it needs a production build; it never builds one itself):
//
//   npm run build
//   npm run screenshots
//   npm run screenshots -- --set=review --review-decisions=a,b,c
//   npm run screenshots -- --set=auth
//   npm run screenshots -- --set=forum --forum-posts=4,5 --forum-decision=1149340
//   npm run screenshots -- --nav-only --readonly
//
// It starts its own `next start` (server.ts) on port 3300, or a free port
// when 3300 is taken, waits until it answers, shoots, and always stops it
// again (also on an error or Ctrl-C). The server always runs against the
// LOCAL database: DB_TARGET=local is forced, and it refuses to start unless
// the LOCAL_* URLs (after loading the env files the way `next start` does)
// all point at localhost. The script itself never connects to a database;
// it only talks HTTP to that server. The server's switches per set:
//   default, --set=review     write mode on (the review pages and the
//                             navbar's write-mode items need it)
//   --set=auth                write mode on, AUTH_BYPASS off
//   --set=forum               AUTH_BYPASS on, write mode on, and the local
//                             app URL set (prismaApp needs it under
//                             `next start`, lib/prisma.ts)
//   --readonly                write mode off (and, with --set=forum, no app
//                             URL, which would turn app writes on)
//
// --base-url=<url> opts out: no server is started, the shots go to that
// URL, and the database behind it isn't checked.
//
// Navbar shots (since 2026-10-09): at 768, 1024, 1280 and 1440, light and
// dark, the top of /matches, the open Menu at 768, and the Review › Cards
// dropdown at 1024, 1280 and 1440 (the row, from lg). Each one also
// measures the bar (scrollWidth against clientWidth, the slack: the free
// space left in the row, and from lg the width the row needs; whether the
// "Game Review" wordmark and the Menu button show) and prints a
// table, written to nav-metrics-<write|readonly>.json too. The
// file names carry the server's mode (nav-write-… / nav-readonly-…), read
// from the page's mode badge. For the read-only shots pass --nav-only
// --readonly.
//
// Options:
//   --base-url=<url>          shoot a server that is already running (not
//                             started or checked by the script)
//   --readonly                start the server with write mode off
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
//   --set=forum               only the forum shots (since 2026-10-13): /forum,
//                             /forum/<id> for each --forum-posts id (and the
//                             interactive move explorer after one click and
//                             after one hop; since Phase 2b also every
//                             "Show analysis" panel expanded, and the post's
//                             edit form when it has an Edit button), /forum/new empty and prefilled
//                             from ?decision=<--forum-decision>,
//                             /position-builder. Reply proposals show their
//                             tally, checker modal, and open checker/cube drafts.
//                             no navbar shots, no review cards. File names
//                             carry the server's mode (forum-write-… /
//                             forum-readonly-…), so run it once as is and
//                             once with --readonly. The started server signs
//                             in through the local AUTH_BYPASS (see above).
//
//   --forum-posts=a,b         ForumPost ids for the /forum/<id> shots
//   --forum-decision=<id>     a Decision id for the prefilled /forum/new shot
//   --set=review             only review-session screenshots at 1280 and 390,
//                             light and dark. It also adds any supplied
//                             --review-decisions first; answer POSTs remain
//                             browser-stubbed. Captures note reason, retry,
//                             Hard-only and Hard/Good states.
//   --set=auth                only /sign-in and /auth/complete, at 1280 and
//                             390, light and dark. The started server runs
//                             WITHOUT AUTH_BYPASS so the real screens show.
//
// The review session's shots take the cards in queue order (new cards in the
// order they were added): card 1 answered with the best option, card 2
// answered wrong, card 3 (if any) answered right but not best (a Good
// answer) when it has such an option, else right.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext } from "@playwright/test";
import { isThemeId, serializeThemeCookie, THEME_COOKIE } from "../../lib/themes";
import {
  BASE_URL,
  EXTERNAL_BASE_URL,
  NAV_ONLY,
  OUT_DIR,
  READONLY,
  SET,
  SET_VARIANTS,
  setBaseUrl,
  THEME,
  VARIANTS,
} from "./config";
import { addReviewCards, removeReviewCards } from "./fixtures";
import { navShots, type NavMetric } from "./nav";
import { startLocalServer } from "./server";
import { AUTH_SHOTS } from "./shots/auth";
import { FORUM_SHOTS } from "./shots/forum";
import { SHOTS } from "./shots/app";

async function shootAll(): Promise<void> {
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
    if (!NAV_ONLY && (!SET || SET === "review")) await addReviewCards(created);
    browser = await chromium.launch({ args: ["--disable-gpu"] });
    if (!SET) metrics = await navShots(browser, addTheme, written, failures);
    const variants = SET ? SET_VARIANTS : NAV_ONLY ? [] : VARIANTS;
    const shots = SET === "forum" ? FORUM_SHOTS : SET === "auth" ? AUTH_SHOTS : SET === "review" ? SHOTS.filter((shot) => shot.name === "review") : SHOTS;
    for (const variant of variants) {
      const context = await browser.newContext({
        viewport: { width: variant.width, height: variant.width === 390 ? 844 : 900 },
        deviceScaleFactor: variant.width === 390 ? 2 : 1,
        colorScheme: variant.theme,
      });
      await addTheme(context);
      for (const shot of shots) {
        if (shot.only && shot.only !== variant.width) continue;
        const page = await context.newPage();
        const shoot = async (name: string, mode: "full" | "viewport") => {
          const file = `${name}--${variant.width}-${variant.theme}--${mode}.png`;
          await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
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

// Starts the local server (server.ts) unless --base-url names one, shoots,
// and always stops the server it started.
async function main(): Promise<void> {
  if (EXTERNAL_BASE_URL) {
    console.warn(`--base-url: no server started; the database behind ${EXTERNAL_BASE_URL} isn't checked.`);
    await shootAll();
    return;
  }
  let server;
  try {
    server = await startLocalServer({ set: SET, readonly: READONLY });
  } catch (err) {
    // A refusal (no build, a non-local URL) or a server that never came up.
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }
  try {
    setBaseUrl(server.baseUrl);
    await shootAll();
  } finally {
    await server.stop();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
