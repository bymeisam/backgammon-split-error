// The one place that reads the database URL env vars. Everything else asks
// this module (ESLint's no-restricted-syntax rule in eslint.config.mjs and
// lib/databaseUrlGuard.test.ts keep it that way).
//
// .env holds both sets of URLs plus one flag:
//   DB_TARGET                       "local" (also when unset or empty) or "oracle"
//   LOCAL_DATABASE_URL[_READONLY|_APP]   the local Docker MySQL
//   ORACLE_DATABASE_URL[_READONLY|_APP]  Oracle HeatWave
// DB_TARGET picks the set; the ORACLE_* vars are read only when it is
// "oracle". Agents never set DB_TARGET=oracle: Oracle runs are the user's.
//
// No imports on purpose: prisma7.config.ts (loaded by Prisma's CLI), the
// navbar badge and the e2e seed script all use this without pulling in a
// Prisma client.

export type DbTarget = "local" | "oracle";
export type DbUrlKind = "rw" | "ro" | "app";

// The env var names, exported so tests and messages can name a variable
// without spelling it out (the ORACLE_* names appear in this file only).
export const DB_URL_VARS: Readonly<Record<DbTarget, Readonly<Record<DbUrlKind, string>>>> = {
  local: {
    rw: "LOCAL_DATABASE_URL",
    ro: "LOCAL_DATABASE_URL_READONLY",
    app: "LOCAL_DATABASE_URL_APP",
  },
  oracle: {
    rw: "ORACLE_DATABASE_URL",
    ro: "ORACLE_DATABASE_URL_READONLY",
    app: "ORACLE_DATABASE_URL_APP",
  },
};

type Env = Readonly<Record<string, string | undefined>>;

// DB_TARGET, unset or empty meaning "local". Anything else throws: a typo
// must never quietly pick a database.
export function dbTarget(env: Env = process.env): DbTarget {
  const raw = env.DB_TARGET;
  if (raw === undefined || raw === "" || raw === "local") return "local";
  if (raw === "oracle") return "oracle";
  throw new Error(`DB_TARGET must be "local" or "oracle" (or unset, meaning local); got "${raw}". See .env.example.`);
}

// One target's URL, whatever DB_TARGET says. Empty counts as unset.
export function targetDbUrl(target: DbTarget, kind: DbUrlKind, env: Env = process.env): string | undefined {
  return env[DB_URL_VARS[target][kind]] || undefined;
}

// The URL for DB_TARGET's database.
export function dbUrl(kind: DbUrlKind, env: Env = process.env): string | undefined {
  return targetDbUrl(dbTarget(env), kind, env);
}

// The name of the variable dbUrl(kind) reads, for error messages.
export function dbUrlVarName(kind: DbUrlKind, env: Env = process.env): string {
  return DB_URL_VARS[dbTarget(env)][kind];
}

// Always the LOCAL_* URL, whatever DB_TARGET says (seeding, local tests).
export function localDbUrl(kind: DbUrlKind, env: Env = process.env): string | undefined {
  return targetDbUrl("local", kind, env);
}

/**
 * The URL prismaApp (lib/prisma.ts) connects with: the target's _APP URL, or
 * outside production the target's read-write URL (so local write mode keeps
 * working without a separate user). Production never falls back to the
 * admin credential. An empty _APP URL counts as unset, as it does in
 * isAppWriteEnabled().
 */
export function appDatabaseUrl(env: Env = process.env): string | undefined {
  return dbUrl("app", env) || (env.NODE_ENV === "production" ? undefined : dbUrl("rw", env));
}

// The name(s) appDatabaseUrl() reads, for error messages.
export function appDatabaseUrlVarName(env: Env = process.env): string {
  return env.NODE_ENV === "production"
    ? dbUrlVarName("app", env)
    : `${dbUrlVarName("app", env)} or ${dbUrlVarName("rw", env)}`;
}

// Compared against the lowercased hostname. "[::1]" is there because the
// WHATWG URL parser keeps the brackets on an IPv6 host for non-special
// schemes like mysql:, and doesn't lowercase their hosts either. A Docker
// Compose service name (e.g. "db") isn't here on purpose: it classes as
// not local, the safe direction.
const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * True only when DB_TARGET is local AND the URLs in use really point at
 * localhost: the read-write URL (required) and the read-only and app URLs
 * when set. So a mistyped LOCAL_* URL can't pass as local. An invalid
 * DB_TARGET is not local.
 */
export function isLocalTarget(env: Env = process.env): boolean {
  let target: DbTarget;
  try {
    target = dbTarget(env);
  } catch {
    return false;
  }
  if (target !== "local") return false;
  const urls = [
    dbUrl("rw", env),
    ...[dbUrl("ro", env), dbUrl("app", env)].filter((url): url is string => url !== undefined),
  ];
  return urls.every((url) => isLocalDatabaseUrl(url));
}
