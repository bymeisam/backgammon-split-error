// The theme registry. Each theme is one CSS file in app/themes/ (imported
// by app/globals.css) that sets the token variables under
// [data-theme="<id>"] plus the mode selectors, and one entry here. The root
// layout puts the active theme and mode on <html> as data-theme/data-mode.
//
// Adding a theme: a new app/themes/<id>.css (same variables as
// clubroom.css), its @import in globals.css, an entry in THEMES, and, if it
// uses a new font, that font loaded in app/layout.tsx (with preload: false
// unless it's the default theme's).
//
// Pure, so it's unit-tested.

export interface ThemeDefinition {
  id: string;
  label: string;
  // The font families the theme's CSS points --theme-font-* at, for the
  // settings page to describe (the fonts themselves load in app/layout.tsx).
  fonts: { sans: string; serif: string | null; mono: string };
}

export const THEMES = [
  {
    id: "clubroom",
    label: "Clubroom",
    fonts: { sans: "Geist", serif: "Newsreader", mono: "Geist Mono" },
  },
  {
    id: "quiet-ink",
    label: "Quiet Ink",
    // One family: titles are Geist too (the serif slot points at Geist).
    fonts: { sans: "Geist", serif: null, mono: "Geist Mono" },
  },
  {
    id: "midnight-felt",
    label: "Midnight Felt",
    fonts: { sans: "Inter", serif: "Playfair Display", mono: "JetBrains Mono" },
  },
] as const satisfies readonly ThemeDefinition[];

export type ThemeId = (typeof THEMES)[number]["id"];

// "system" follows the OS (prefers-color-scheme).
export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const DEFAULT_THEME: ThemeId = "clubroom";
export const DEFAULT_MODE: ThemeMode = "system";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((t) => t.id === value);
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (THEME_MODES as readonly string[]).includes(value);
}

// The theme and mode to render, from whatever was stored (the bgtheme
// cookie, through themeSettingsFromCookie). Anything unknown or missing
// falls back to the default, so a stale or hand-edited value can't break
// the page.
export function resolveThemeSettings(stored?: { theme?: unknown; mode?: unknown }): {
  theme: ThemeId;
  mode: ThemeMode;
} {
  return {
    theme: isThemeId(stored?.theme) ? stored.theme : DEFAULT_THEME,
    mode: isThemeMode(stored?.mode) ? stored.mode : DEFAULT_MODE,
  };
}

export interface ThemeSettings {
  theme: ThemeId;
  mode: ThemeMode;
}

// The user's choice lives in one cookie, per browser (a display preference,
// so not in the DB, and no write gate: it works on the read-only site too).
// The value is "<theme>.<mode>", e.g. "midnight-felt.dark"; theme ids never
// contain a dot. The root layout reads it on the server (app/layout.tsx), so
// <html data-theme data-mode> arrives right in the first HTML; /settings
// writes it in the browser (themeCookieString).
export const THEME_COOKIE = "bgtheme";
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// The cookie's raw value split into its two parts, unvalidated. Anything
// that isn't "<a>.<b>" gives {}, which resolves to the defaults.
export function parseThemeCookie(value: string | null | undefined): { theme?: string; mode?: string } {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return {};
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return {};
  }
  const parts = decoded.split(".");
  if (parts.length !== 2) return {};
  return { theme: parts[0], mode: parts[1] };
}

// The cookie's value to the theme and mode to render: validated against the
// registry, each part falling back on its own (Clubroom, System).
export function themeSettingsFromCookie(value: string | null | undefined): ThemeSettings {
  return resolveThemeSettings(parseThemeCookie(value));
}

export function serializeThemeCookie(settings: ThemeSettings): string {
  return `${settings.theme}.${settings.mode}`;
}

// The whole string for document.cookie: one year, the whole site, Lax.
export function themeCookieString(settings: ThemeSettings): string {
  return `${THEME_COOKIE}=${serializeThemeCookie(settings)}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
