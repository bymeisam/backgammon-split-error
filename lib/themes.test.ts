import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODE,
  DEFAULT_THEME,
  THEME_COOKIE,
  THEME_MODES,
  THEMES,
  parseThemeCookie,
  resolveThemeSettings,
  serializeThemeCookie,
  themeCookieString,
  themeSettingsFromCookie,
} from "@/lib/themes";

describe("resolveThemeSettings", () => {
  it("defaults to Clubroom, following the system mode", () => {
    expect(resolveThemeSettings()).toEqual({ theme: "clubroom", mode: "system" });
    expect(DEFAULT_THEME).toBe("clubroom");
    expect(DEFAULT_MODE).toBe("system");
  });

  it("keeps known values", () => {
    expect(resolveThemeSettings({ theme: "clubroom", mode: "dark" })).toEqual({ theme: "clubroom", mode: "dark" });
    expect(resolveThemeSettings({ mode: "light" }).mode).toBe("light");
  });

  it("falls back on unknown values", () => {
    expect(resolveThemeSettings({ theme: "nope", mode: "dim" })).toEqual({ theme: "clubroom", mode: "system" });
    expect(resolveThemeSettings({ theme: 3, mode: null })).toEqual({ theme: "clubroom", mode: "system" });
  });
});

describe("the bgtheme cookie", () => {
  it("parses '<theme>.<mode>' into its two parts", () => {
    expect(parseThemeCookie("midnight-felt.dark")).toEqual({ theme: "midnight-felt", mode: "dark" });
    expect(parseThemeCookie("quiet-ink.system")).toEqual({ theme: "quiet-ink", mode: "system" });
    expect(parseThemeCookie("midnight-felt%2Edark")).toEqual({ theme: "midnight-felt", mode: "dark" });
  });

  it("gives nothing for a missing or malformed value", () => {
    expect(parseThemeCookie(undefined)).toEqual({});
    expect(parseThemeCookie(null)).toEqual({});
    expect(parseThemeCookie("")).toEqual({});
    expect(parseThemeCookie("clubroom")).toEqual({});
    expect(parseThemeCookie("a.b.c")).toEqual({});
    expect(parseThemeCookie("%E0%A4%A")).toEqual({}); // bad percent-encoding
    expect(parseThemeCookie(`${"x".repeat(70)}.dark`)).toEqual({});
  });

  it("validates against the registry, each part falling back on its own", () => {
    for (const theme of THEMES) {
      for (const mode of THEME_MODES) {
        expect(themeSettingsFromCookie(serializeThemeCookie({ theme: theme.id, mode }))).toEqual({ theme: theme.id, mode });
      }
    }
    expect(themeSettingsFromCookie("garbage")).toEqual({ theme: "clubroom", mode: "system" });
    expect(themeSettingsFromCookie("<script>.dark")).toEqual({ theme: "clubroom", mode: "dark" });
    expect(themeSettingsFromCookie("quiet-ink.dim")).toEqual({ theme: "quiet-ink", mode: "system" });
    expect(themeSettingsFromCookie("Quiet-Ink.Dark")).toEqual({ theme: "clubroom", mode: "system" });
    expect(themeSettingsFromCookie(undefined)).toEqual({ theme: "clubroom", mode: "system" });
  });

  it("writes one cookie for a year, site-wide, SameSite=Lax", () => {
    expect(THEME_COOKIE).toBe("bgtheme");
    expect(themeCookieString({ theme: "midnight-felt", mode: "dark" })).toBe(
      "bgtheme=midnight-felt.dark; Path=/; Max-Age=31536000; SameSite=Lax"
    );
  });
});

describe("theme files", () => {
  const globals = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8");

  it("has a CSS file, imported by globals.css, for every registered theme", () => {
    for (const theme of THEMES) {
      expect(globals).toContain(`@import "./themes/${theme.id}.css";`);
      const css = readFileSync(path.resolve(__dirname, `../app/themes/${theme.id}.css`), "utf8");
      expect(css).toContain(`[data-theme="${theme.id}"] {`);
      expect(css).toContain(`[data-theme="${theme.id}"][data-mode="dark"] {`);
      expect(css).toContain(`[data-theme="${theme.id}"][data-mode="system"] {`);
    }
  });

  it("defines every variable globals.css maps to Tailwind, in every theme", () => {
    const used = new Set([...globals.matchAll(/var\(--([a-z-]+)\)/g)].map((m) => m[1]));
    // The next/font variables are set by app/layout.tsx, not by a theme.
    for (const name of ["font-geist-sans", "font-geist-mono", "font-newsreader"]) used.delete(name);
    // Variables globals.css defines itself (its @theme blocks).
    for (const m of globals.matchAll(/--([a-z-]+):/g)) used.delete(m[1]);
    for (const theme of THEMES) {
      const css = readFileSync(path.resolve(__dirname, `../app/themes/${theme.id}.css`), "utf8");
      for (const name of used) expect(css, `${theme.id} defines --${name}`).toMatch(new RegExp(`--${name}:`));
    }
  });

  // Every --font-* a theme points its --theme-font-* at is a next/font
  // variable app/layout.tsx loads. Fonts only another theme uses are not
  // preloaded, so the default theme's pages don't fetch them.
  it("wires each theme's fonts to fonts the layout loads", () => {
    const layout = readFileSync(path.resolve(__dirname, "../app/layout.tsx"), "utf8");
    const loaded = new Map<string, string>();
    for (const m of layout.matchAll(/=\s*[A-Za-z_]+\(\{([^}]*)\}\)/g)) {
      const variable = m[1].match(/variable:\s*"--([a-z-]+)"/)?.[1];
      if (variable) loaded.set(variable, m[1]);
    }
    const defaultCss = readFileSync(path.resolve(__dirname, `../app/themes/${DEFAULT_THEME}.css`), "utf8");
    const defaultFonts = new Set([...defaultCss.matchAll(/--theme-font-[a-z]+:\s*var\(--([a-z-]+)\)/g)].map((m) => m[1]));
    for (const theme of THEMES) {
      const css = readFileSync(path.resolve(__dirname, `../app/themes/${theme.id}.css`), "utf8");
      const refs = [...css.matchAll(/--theme-font-[a-z]+:\s*var\(--([a-z-]+)\)/g)].map((m) => m[1]);
      expect(refs.length, `${theme.id} sets its fonts`).toBeGreaterThanOrEqual(3);
      for (const ref of refs) {
        expect(loaded.has(ref), `${theme.id}: --${ref} is loaded in app/layout.tsx`).toBe(true);
        if (!defaultFonts.has(ref)) expect(loaded.get(ref), `--${ref} has preload: false`).toMatch(/preload:\s*false/);
      }
    }
  });

  // The dark values appear twice in each theme file (explicit dark mode, and
  // system mode on a dark OS); plain CSS can't share one block between a
  // selector and a media query, so this keeps the copies in step.
  it("keeps each theme's two dark blocks identical", () => {
    for (const theme of THEMES) {
      const css = readFileSync(path.resolve(__dirname, `../app/themes/${theme.id}.css`), "utf8");
      const block = (selector: string): string => {
        const start = css.indexOf(`${selector} {`);
        expect(start, `${theme.id}: ${selector}`).toBeGreaterThanOrEqual(0);
        const body = css.slice(start + selector.length + 2, css.indexOf("}", start));
        return body
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .join("\n");
      };
      const dark = block(`[data-theme="${theme.id}"][data-mode="dark"]`);
      const system = block(`[data-theme="${theme.id}"][data-mode="system"]`);
      expect(dark.length).toBeGreaterThan(0);
      expect(system).toBe(dark);
    }
  });
});
