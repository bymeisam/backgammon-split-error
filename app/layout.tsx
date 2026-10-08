import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GameStatsAuthProvider } from "./providers/GameStatsAuthProvider";
import { DecisionNotesProvider } from "./providers/DecisionNotesProvider";
import { ReviewStateProvider } from "./providers/ReviewStateProvider";
import AppNav from "./components/ui/AppNav";
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

export const metadata: Metadata = {
  title: "Galaxy Game Review Dumper",
  description: "Fetch raw game_reviews JSON for a Backgammon Galaxy match",
};

// The navbar sits inside GameStatsAuthProvider: its sync button reads the
// same in-memory Galaxy token the /galaxy pages set.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={style.html(geistSans.variable, geistMono.variable)}>
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
