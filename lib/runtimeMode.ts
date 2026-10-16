// The navbar's database/mode badge. Worked out on the server only. The label
// is the one thing that leaves the server: never pass a database URL (any
// of lib/databaseUrl.ts's), a host or any part of any URL to a client
// component.
//
// - Write mode is lib/appWriteGate.ts's isAppWriteEnabled() (the target's
//   app URL set, or locally its read-write URL with ENABLE_WRITE_MODE=true),
//   so a deploy with no app URL always reads "Read-only".
// - In write mode each URL is classed "Local" or "Oracle": the app write URL
//   (lib/databaseUrl.ts's appDatabaseUrl(): the target's app URL, or locally
//   its read-write URL; the `prismaApp` client) and dbUrl("ro") (reads, the
//   `prismaReadOnly` client every page reads through). The class comes from
//   the URL's host, not from DB_TARGET, so the badge shows where the URLs
//   really point. The same class for
//   both reads "Local · write" / "Oracle · write"; different classes read
//   "Writes: Oracle · Reads: Local" / "Writes: Local · Reads: Oracle".
// - "Local" means the URL's host is localhost, 127.0.0.1 or ::1. Any other
//   host, and a URL that's missing or doesn't parse, reads "Oracle": when in
//   doubt, say the real database.
import { isAppWriteEnabled } from "@/lib/appWriteGate";
import { appDatabaseUrl, dbUrl, isLocalDatabaseUrl } from "@/lib/databaseUrl";

export { isLocalDatabaseUrl };

export type DatabaseClass = "Local" | "Oracle";

export type RuntimeModeLabel =
  | "Oracle · write"
  | "Local · write"
  | "Writes: Oracle · Reads: Local"
  | "Writes: Local · Reads: Oracle"
  | "Read-only";

// isLocalDatabaseUrl (localhost, 127.0.0.1, ::1) lives in lib/databaseUrl.ts.
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
    writeEnabled: isAppWriteEnabled(),
    databaseUrl: appDatabaseUrl(),
    readOnlyDatabaseUrl: dbUrl("ro"),
  });
}
