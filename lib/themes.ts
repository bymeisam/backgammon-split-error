// The theme registry. Each theme is one CSS file in app/themes/ (imported
// by app/globals.css) that sets the token variables under
// [data-theme="<id>"] plus the mode selectors, and one entry here. The root
// layout puts the active theme and mode on <html> as data-theme/data-mode.
//
// Adding a theme: a new app/themes/<id>.css (same variables as
// clubroom.css), its @import in globals.css, an entry in THEMES, and, if it
// uses a new font, that font loaded in app/layout.tsx.
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

// The theme and mode to render, from whatever was stored (a cookie, in
// phase 3; nothing yet). Anything unknown or missing falls back to the
// default, so a stale or hand-edited value can't break the page.
export function resolveThemeSettings(stored?: { theme?: unknown; mode?: unknown }): {
  theme: ThemeId;
  mode: ThemeMode;
} {
  return {
    theme: isThemeId(stored?.theme) ? stored.theme : DEFAULT_THEME,
    mode: isThemeMode(stored?.mode) ? stored.mode : DEFAULT_MODE,
  };
}
