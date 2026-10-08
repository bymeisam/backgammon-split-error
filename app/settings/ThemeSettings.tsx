"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SeverityBadge from "@/app/components/ui/SeverityBadge";
import { THEMES, themeCookieString, type ThemeMode, type ThemeSettings as Settings } from "@/lib/themes";
import { style, type PreviewSwatch } from "./settings.styles";

const MODE_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: "system", label: "System" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
];

const SWATCHES: PreviewSwatch[] = ["paper", "surface", "ink", "accent", "primary"];

// One theme's live preview. data-theme and data-mode on this element scope
// every token inside it to that theme (app/themes/*.css), in the mode
// currently chosen, so it shows what the theme will look like.
function ThemePreview({ themeId, mode }: { themeId: string; mode: ThemeMode }) {
  return (
    <div data-theme={themeId} data-mode={mode} className={style.preview} aria-hidden="true">
      <div className={style.previewTitleRow}>
        <span className={style.previewTitle}>Aa</span>
        <span className={style.previewVerdict}>Correct.</span>
      </div>
      <div className={style.swatchRow}>
        {SWATCHES.map((s) => (
          <span key={s} className={style.swatch(s)} />
        ))}
        <span className={style.board}>
          <span className={style.boardBone}>
            <span className={style.boardPoint(true)} />
            <span className={style.boardPoint(false)} />
            <span className={style.boardChecker("mine")} />
            <span className={style.boardChecker("opponent")} />
          </span>
        </span>
      </div>
      <div className={style.chipRow}>
        <SeverityBadge type="best" />
        <SeverityBadge type="good" />
        <SeverityBadge type="error" />
        <SeverityBadge type="blunder" />
      </div>
    </div>
  );
}

// Stores the choice (the bgtheme cookie) and switches the page to it at
// once, by setting the attributes the theme CSS keys on.
function saveAndApplyTheme(next: Settings): void {
  document.cookie = themeCookieString(next);
  const html = document.documentElement;
  html.setAttribute("data-theme", next.theme);
  html.setAttribute("data-mode", next.mode);
}

// The theme and mode pickers. A change applies at once: the cookie is set
// (lib/themes.ts, one year, Path=/, SameSite=Lax), <html>'s data-theme and
// data-mode are updated in place, and router.refresh() re-renders the
// server tree so the root layout's own <html> attributes (read from the
// cookie) agree. Only a cookie: no DB, so no write-mode gate.
export default function ThemeSettings({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(initial);

  function apply(next: Settings) {
    setSettings(next);
    saveAndApplyTheme(next);
    router.refresh();
  }

  return (
    <>
      <section className={style.section} aria-labelledby="settings-theme">
        <div className={style.sectionHead}>
          <h2 id="settings-theme" className={style.sectionTitle}>
            Theme
          </h2>
          <p className={style.sectionNote}>Saved in this browser only.</p>
        </div>
        <div className={style.themeGrid} role="radiogroup" aria-labelledby="settings-theme">
          {THEMES.map((theme) => {
            const selected = settings.theme === theme.id;
            return (
              <label key={theme.id} className={style.themeOption(selected)} data-testid={`theme-option-${theme.id}`}>
                <span className={style.themeOptionHead}>
                  <input
                    type="radio"
                    name="theme"
                    value={theme.id}
                    checked={selected}
                    onChange={() => apply({ ...settings, theme: theme.id })}
                    className={style.themeRadio}
                  />
                  <span className={style.themeName}>{theme.label}</span>
                </span>
                <ThemePreview themeId={theme.id} mode={settings.mode} />
                <span className={style.themeFonts}>
                  {theme.fonts.serif ? `${theme.fonts.serif} and ${theme.fonts.sans}` : theme.fonts.sans}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className={style.section} aria-labelledby="settings-mode">
        <div className={style.sectionHead}>
          <h2 id="settings-mode" className={style.sectionTitle}>
            Mode
          </h2>
          <p className={style.sectionNote}>System follows your device&apos;s light or dark setting.</p>
        </div>
        <div className={style.modeTrack} role="radiogroup" aria-labelledby="settings-mode">
          {MODE_OPTIONS.map(({ mode, label }) => {
            const selected = settings.mode === mode;
            return (
              <label key={mode} className={style.modeOption(selected)} data-testid={`mode-option-${mode}`}>
                <input
                  type="radio"
                  name="mode"
                  value={mode}
                  checked={selected}
                  onChange={() => apply({ ...settings, mode })}
                  className={style.modeRadio}
                />
                {label}
              </label>
            );
          })}
        </div>
      </section>
    </>
  );
}
