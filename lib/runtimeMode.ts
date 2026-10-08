// The navbar's database/mode badge. Worked out on the server only. The label
// is the one thing that leaves the server: never pass DATABASE_URL,
// DATABASE_URL_READONLY, a host or any part of either URL to a client
// component.
//
// - Write mode is lib/galaxyGate.ts's isGalaxyEnabled() (needs DATABASE_URL
//   and ENABLE_WRITE_MODE=true), so the live read-only site (Vercel, no
//   DATABASE_URL) always reads "Read-only".
// - In write mode each URL is classed "Local" or "Oracle": DATABASE_URL
//   (writes, the `prisma` client) and DATABASE_URL_READONLY (reads, the
//   `prismaReadOnly` client every page reads through). The same class for
//   both reads "Local · write" / "Oracle · write"; different classes read
//   "Writes: Oracle · Reads: Local" / "Writes: Local · Reads: Oracle".
// - "Local" means the URL's host is localhost, 127.0.0.1 or ::1. Any other
//   host, and a URL that's missing or doesn't parse, reads "Oracle": when in
//   doubt, say the real database.
import { isGalaxyEnabled } from "@/lib/galaxyGate";

export type DatabaseClass = "Local" | "Oracle";

export type RuntimeModeLabel =
  | "Oracle · write"
  | "Local · write"
  | "Writes: Oracle · Reads: Local"
  | "Writes: Local · Reads: Oracle"
  | "Read-only";

// Compared against the lowercased hostname. "[::1]" is there because the
// WHATWG URL parser keeps the brackets on an IPv6 host for non-special
// schemes like mysql:, and doesn't lowercase their hosts either. A Docker
// Compose service name (e.g. "db") isn't here on purpose: it classes as
// Oracle, the safe direction (the badge over-warns rather than under-warns).
const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function databaseClass(url: string | undefined): DatabaseClass {
  return isLocalDatabaseUrl(url) ? "Local" : "Oracle";
}

export function runtimeModeLabel(opts: {
  writeEnabled: boolean;
  databaseUrl: string | undefined;
  readOnlyDatabaseUrl: string | undefined;
}): RuntimeModeLabel {
  if (!opts.writeEnabled) return "Read-only";
  const writes = databaseClass(opts.databaseUrl);
  const reads = databaseClass(opts.readOnlyDatabaseUrl);
  if (writes === reads) return writes === "Local" ? "Local · write" : "Oracle · write";
  return writes === "Oracle" ? "Writes: Oracle · Reads: Local" : "Writes: Local · Reads: Oracle";
}

// The running server's label, from its own env.
export function currentRuntimeModeLabel(): RuntimeModeLabel {
  return runtimeModeLabel({
    writeEnabled: isGalaxyEnabled(),
    databaseUrl: process.env.DATABASE_URL,
    readOnlyDatabaseUrl: process.env.DATABASE_URL_READONLY,
  });
}
