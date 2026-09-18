"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Holds the parsed authorization header for Backgammon Galaxy's own
// game-data API. In memory only — no localStorage/sessionStorage/cookies —
// so it's cleared on every page reload by design. This is deliberately not
// named AuthProvider/useAuth: it's a third-party API credential, not the
// app's own user authentication (which doesn't exist yet).
interface GameStatsAuthValue {
  token: string | null;
  setToken: (token: string | null) => void;
}

const GameStatsAuthContext = createContext<GameStatsAuthValue | undefined>(undefined);

export function GameStatsProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  return (
    <GameStatsAuthContext.Provider value={{ token, setToken }}>
      {children}
    </GameStatsAuthContext.Provider>
  );
}

export function useGameStatsAuth(): GameStatsAuthValue {
  const ctx = useContext(GameStatsAuthContext);
  if (!ctx) {
    throw new Error("useGameStatsAuth must be used within a GameStatsProvider.");
  }
  return ctx;
}
