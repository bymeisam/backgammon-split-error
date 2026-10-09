import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Inter, JetBrains_Mono, Newsreader, Playfair_Display } from "next/font/google";
import { GameStatsAuthProvider } from "./providers/GameStatsAuthProvider";
import { DecisionNotesProvider } from "./providers/DecisionNotesProvider";
import { ReviewStateProvider } from "./providers/ReviewStateProvider";
import AppNav from "./components/ui/AppNav";
import { THEME_COOKIE, themeSettingsFromCookie } from "@/lib/themes";
import { style } from "./layout.styles";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The serif for titles, big figures and notes (Clubroom). Variable, with
// its optical-size axis so large titles get the display cut.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
});

// Midnight Felt's fonts (app/themes/midnight-felt.css). Not preloaded: a
// page only downloads them when the active theme points --theme-font-* at
// them, so Clubroom and Quiet Ink pages don't fetch fonts they never use.
// (Quiet Ink uses Geist and Geist Mono, above.) Clubroom, the default, keeps
// its fonts preloaded.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  preload: false,
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Game Review",
  description: "Review your backgammon matches, mistakes and positions.",
};

// The navbar sits inside GameStatsAuthProvider: its sync button reads the
// same in-memory Galaxy token the /sources/galaxy pages set.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The theme and mode on <html> (lib/themes.ts), from the user's bgtheme
  // cookie (set on /settings), so the first HTML already carries them and
  // nothing flashes. No cookie, or anything unknown in it: Clubroom,
  // following the OS's light/dark. Reading cookies() makes every page
  // dynamic; they already are (AppNav calls connection()).
  const { theme, mode } = themeSettingsFromCookie((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={theme}
      data-mode={mode}
      className={style.html([
        geistSans.variable,
        geistMono.variable,
        newsreader.variable,
        inter.variable,
        playfairDisplay.variable,
        jetbrainsMono.variable,
      ])}
    >
      <body className={style.body}>
        <GameStatsAuthProvider>
          <AppNav />
          <DecisionNotesProvider>
            <ReviewStateProvider>{children}</ReviewStateProvider>
          </DecisionNotesProvider>
        </GameStatsAuthProvider>
      </body>
    </html>
  );
}
