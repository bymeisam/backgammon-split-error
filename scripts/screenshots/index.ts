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
//   npx tsx scripts/screenshots/index.ts
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
//   npx tsx scripts/screenshots/index.ts --base-url=http://localhost:3301 --nav-only
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
//                             forum-readonly-…), so run it once against a
//                             write-mode server and once against a
//                             read-only one. The forum's pages need a
//                             signed-in owner: start the server with the
//                             local AUTH_BYPASS=true on its command line
//                             (never in .env), against the local DB. Under
//                             `next start` (production) prismaApp needs
//                             LOCAL_DATABASE_URL_APP on the command line too
//                             (lib/prisma.ts), pointed at the local DB; it
//                             also turns app writes on (lib/appWriteGate.ts),
//                             so leave it off for the read-only run:
//
//   LOCAL_DATABASE_URL_APP=<local mysql URL> AUTH_BYPASS=true ENABLE_WRITE_MODE=true npx next start -p 3300
//   npx tsx scripts/screenshots/index.ts --set=forum --forum-posts=4,5 --forum-decision=1149340 --date=2026-10-13-forum
//
//   --forum-posts=a,b         ForumPost ids for the /forum/<id> shots
//   --forum-decision=<id>     a Decision id for the prefilled /forum/new shot
//   --set=review             only review-session screenshots at 1280 and 390,
//                             light and dark. It also adds any supplied
//                             --review-decisions first; answer POSTs remain
//                             browser-stubbed. Captures note reason, retry,
//                             Hard-only and Hard/Good states.
//   --set=auth                only /sign-in and /auth/complete, at 1280 and
//                             390, light and dark. Point it at a server
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
import { BASE_URL, NAV_ONLY, OUT_DIR, SET, SET_VARIANTS, THEME, VARIANTS } from "./config";
import { addReviewCards, removeReviewCards } from "./fixtures";
import { navShots, type NavMetric } from "./nav";
import { AUTH_SHOTS } from "./shots/auth";
import { FORUM_SHOTS } from "./shots/forum";
import { SHOTS } from "./shots/app";

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

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
