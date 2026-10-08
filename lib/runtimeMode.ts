// The navbar's database/mode badge: "Oracle · write", "Local · write" or
// "Read-only". Worked out on the server only. The label is the one thing
// that leaves the server: never pass DATABASE_URL, its host or any part of
// it to a client component.
//
// - Write mode is lib/galaxyGate.ts's isGalaxyEnabled() (needs DATABASE_URL
//   and ENABLE_WRITE_MODE=true), so the live read-only site (Vercel, no
//   DATABASE_URL) always reads "Read-only".
// - "Local" means DATABASE_URL's host is localhost or 127.0.0.1. Any other
//   host, and a URL that doesn't parse, reads "Oracle": when in doubt, say
//   writes go to the real database.
import { isGalaxyEnabled } from "@/lib/galaxyGate";

export type RuntimeModeLabel = "Oracle · write" | "Local · write" | "Read-only";

const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1"]);

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function runtimeModeLabel(opts: {
  writeEnabled: boolean;
  databaseUrl: string | undefined;
}): RuntimeModeLabel {
  if (!opts.writeEnabled) return "Read-only";
  return isLocalDatabaseUrl(opts.databaseUrl) ? "Local · write" : "Oracle · write";
}

// The running server's label, from its own env.
export function currentRuntimeModeLabel(): RuntimeModeLabel {
  return runtimeModeLabel({
    writeEnabled: isGalaxyEnabled(),
    databaseUrl: process.env.DATABASE_URL,
  });
}
