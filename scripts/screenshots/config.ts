// The command-line flags, the variant lists and the fixed ids the shots use.
import path from "node:path";
import { isThemeId, THEMES } from "../../lib/themes";
import type { Variant } from "./helpers";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// --base-url: shoot an already-running server instead of starting one.
export const EXTERNAL_BASE_URL = arg("base-url")?.replace(/\/$/, "");
// The app's URL: the external one, or (set by main() once the server is up)
// the local server server.ts starts. A live binding, so every module sees
// the value main() sets.
export let BASE_URL = EXTERNAL_BASE_URL ?? "http://localhost:3300";
export function setBaseUrl(url: string): void {
  BASE_URL = url.replace(/\/$/, "");
}
// --readonly: the started server runs with write mode off.
export const READONLY = process.argv.includes("--readonly");
export const DATE = arg("date") ?? today();
export const THEME = arg("theme");
if (THEME !== undefined && !isThemeId(THEME)) {
  console.error(`Unknown --theme=${THEME}; known: ${THEMES.map((t) => t.id).join(", ")}`);
  process.exit(1);
}
export const OUT_DIR = path.resolve(process.cwd(), "design", "screenshots", DATE, ...(THEME ? [THEME] : []));
export const NAV_ONLY = process.argv.includes("--nav-only");
export const REVIEW_DECISIONS = (arg("review-decisions") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);

export const SET = arg("set");
if (SET !== undefined && SET !== "forum" && SET !== "auth" && SET !== "review" && SET !== "snaps") {
  console.error(`Unknown --set=${SET}; known: forum, auth, review, snaps`);
}
export const FORUM_POSTS = (arg("forum-posts") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);
export const FORUM_DECISION = arg("forum-decision");

// The forum and auth sets' widths: the designer's desktop (1280) and mobile.
export const SET_VARIANTS: Variant[] = ([1280, 390] as const).flatMap((width) =>
  (["light", "dark"] as const).map((theme) => ({ width, theme }))
);

export const VARIANTS: Variant[] = [
  { width: 1440, theme: "light" },
  { width: 1440, theme: "dark" },
  { width: 390, theme: "light" },
  { width: 390, theme: "dark" },
];

// The navbar shots' widths: the Menu panel at 768 (md itself), the full
// row at 1024 (lg itself, the tightest row, with the wordmark hidden), 1280
// (xl, the wordmark back) and 1440.
export const NAV_VARIANTS: Variant[] = ([768, 1024, 1280, 1440] as const).flatMap((width) =>
  (["light", "dark"] as const).map((theme) => ({ width, theme }))
);

// The data the pages show: real local matches used throughout PROGRESS.md.
export const MATCH = "47816592";
export const REPLAY = "/matches/45282503/replay/2";
// Replay steps ("Move N of 25"), reached with the replay's own ↓ key (→
// until the keyboard batch of 2026-10-09 made ←/→ the Played/Best tabs).
export const REPLAY_CHECKER_ERROR = 2; // a checker error
export const REPLAY_CHECKER_CUBE_OWNED = 15; // a checker play, the opponent owns the 2-cube
export const REPLAY_CUBE_TAKE = 16; // "Opponent redoubles to 4: you took"
