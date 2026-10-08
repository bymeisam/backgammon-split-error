import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_MODE, DEFAULT_THEME, THEMES, resolveThemeSettings } from "@/lib/themes";

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
});
