import { useEffect, useState } from "react";
import type { PlayerIdentity } from "@/lib/playerIdentity";

// One request per page load, shared by every caller (/matches/[matchId]'s
// breadcrumb and MistakesSection both need the list, about 2.1k rows). The
// promise lives at module level, so a full page reload fetches again. A
// failed request isn't kept: the cache is cleared and the next caller to
// mount retries.
let shared: Promise<PlayerIdentity[]> | null = null;

export function loadPlayerIdentities(): Promise<PlayerIdentity[]> {
  if (!shared) {
    const request = fetch("/api/player-identities")
      .then((res) => {
        if (!res.ok) throw new Error(`player-identities: HTTP ${res.status}`);
        return res.json() as Promise<PlayerIdentity[]>;
      })
      .catch((error: unknown) => {
        if (shared === request) shared = null;
        throw error;
      });
    shared = request;
  }
  return shared;
}

// Tests only: forget the shared request.
export function resetPlayerIdentitiesCache(): void {
  shared = null;
}

// Every known PlayerIdentity (/api/player-identities), loaded on mount
// through the shared request above. Empty until loaded, and stays empty if
// the request fails — non-fatal for callers, which fall back to raw userIds.
export function usePlayerIdentities(): PlayerIdentity[] {
  const [identities, setIdentities] = useState<PlayerIdentity[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadPlayerIdentities()
      .then((list) => {
        if (!cancelled) setIdentities(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return identities;
}
