import "./globals.css";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { cookies, headers } from "next/headers";
import { Geist, Geist_Mono, Inter, JetBrains_Mono, Newsreader, Playfair_Display } from "next/font/google";
import { GameStatsAuthProvider } from "./providers/GameStatsAuthProvider";
import { DecisionNotesProvider } from "./providers/DecisionNotesProvider";
import { ReviewStateProvider } from "./providers/ReviewStateProvider";
import AppNav from "./components/ui/AppNav";
import { THEME_COOKIE, themeSettingsFromCookie } from "@/lib/themes";
import { style } from "./layout.styles";
import { getAppRole, requireMemberDocument, requireOwnerDocument } from "@/lib/app-auth";
import { accessTierFor } from "@/lib/accessRules";
import { AUTH_COMPLETE_PATH, SIGN_IN_PATH } from "@/lib/clerkConfig";

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
// same in-memory Galaxy token the /sources/galaxy pages set. ClerkProvider
// wraps everything so client components can read the signed-in user.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The theme and mode on <html> (lib/themes.ts), from the user's bgtheme
  // cookie (set on /settings), so the first HTML already carries them and
  // nothing flashes. No cookie, or anything unknown in it: Clubroom,
  // following the OS's light/dark. Reading cookies() (and headers() below)
  // makes every page dynamic.
  const { theme, mode } = themeSettingsFromCookie((await cookies()).get(THEME_COOKIE)?.value);

  // Access wall for pages. proxy.ts has already made sure the visitor is
  // signed in and passes the request path as x-app-route; here each page
  // gets its tier from the one access table (lib/accessRules.ts): public
  // pages (sign-in, /auth/complete) need nothing and get no navbar; member
  // pages need an invited member or the owner; everything else is owner
  // only (a member gets a 404). lib/app-auth.ts resolves the role, including
  // under the local AUTH_BYPASS (lib/localAuthBypass.ts, owner by default,
  // a member with AUTH_BYPASS_ROLE=member).
  //
  // This is the second layer, not the only one: layouts don't re-render on
  // client-side navigation, so every page also calls the guard for its tier
  // itself (lib/accessRules.test.ts checks that). Fail closed: no header
  // (proxy.ts didn't run) means owner. The public pages always get the
  // header, since proxy.ts's matcher covers /sign-in/** and /auth/complete.
  const requestHeaders = await headers();
  const appRoute = requestHeaders.get("x-app-route");
  const tier = appRoute ? accessTierFor(appRoute) : "owner";
  const isPublicRoute = tier === "public";
  if (tier === "member") await requireMemberDocument();
  else if (tier === "owner") await requireOwnerDocument();
  const role = isPublicRoute ? null : await getAppRole();
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
        <ClerkProvider
          signInUrl={SIGN_IN_PATH}
          signInFallbackRedirectUrl={AUTH_COMPLETE_PATH}
          signUpFallbackRedirectUrl={AUTH_COMPLETE_PATH}
        >
          <GameStatsAuthProvider>
            {!isPublicRoute && <AppNav role={role} />}
            <DecisionNotesProvider>
              <ReviewStateProvider>{children}</ReviewStateProvider>
            </DecisionNotesProvider>
          </GameStatsAuthProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
