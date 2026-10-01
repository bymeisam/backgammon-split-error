import { useEffect, useState } from "react";
import type { PlayerIdentity } from "@/lib/playerIdentity";

// Every known PlayerIdentity (/api/player-identities), fetched once on
// mount. Empty until loaded, and stays empty if the request fails —
// non-fatal for callers, which fall back to raw userIds.
export function usePlayerIdentities(): PlayerIdentity[] {
  const [identities, setIdentities] = useState<PlayerIdentity[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/player-identities")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setIdentities(json as PlayerIdentity[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return identities;
}
