// Read-only SQL runner for the investigator subagent (.claude/agents/
// investigator.md) — the only way it reaches either database.
//
// Three layers, so a mistake in any one of them still can't write:
//   1. Credentials: only ever bg_db_ro (SELECT-only grant on both local and
//      Oracle). The script refuses to run if the URL's user is anything else,
//      so a .env switch to bg_db_rw/admin can't silently leak in.
//   2. Session: SET SESSION TRANSACTION READ ONLY before the statement.
//   3. Statement: only SELECT / WITH / EXPLAIN / SHOW / DESCRIBE / DESC, one
//      statement per call.
// --grant-check skips layers 2 and 3 (never layer 1) — it exists only to
// prove the server-side grant itself refuses a write, and only on local.
//
// Targets:
//   local  → DATABASE_URL_READONLY, must point at localhost/127.0.0.1
//   oracle → ORACLE_DATABASE_URL_READONLY (separate var, so reading Oracle
//            never means re-pointing DATABASE_URL*; TLS via the same pinned
//            CA as the app, through lib/prisma.ts's buildConnectionConfig)
//
// Never prints the connection URL or password. Prints elapsed time with every
// result, so Decision queries always come with timing.
//
// Usage:
//   npx tsx scripts/ro-query.ts --target local "SELECT COUNT(*) FROM `Match`"
//   npx tsx scripts/ro-query.ts --target oracle "EXPLAIN SELECT ..."
import "dotenv/config";
import mariadb, { type Connection, type ConnectionConfig } from "mariadb";
import { buildConnectionConfig } from "@/lib/prisma";

const READ_ONLY_USER = "bg_db_ro";
const ALLOWED_STATEMENT = /^\s*(SELECT|WITH|EXPLAIN|SHOW|DESCRIBE|DESC)\b/i;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function fail(message: string): never {
  console.error(`ro-query: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { target: "local" | "oracle"; grantCheck: boolean; sql: string } {
  let target: string | undefined;
  let grantCheck = false;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--target") target = argv[++i];
    else if (argv[i] === "--grant-check") grantCheck = true;
    else rest.push(argv[i]);
  }
  if (target !== "local" && target !== "oracle") fail('--target must be "local" or "oracle".');
  if (rest.length !== 1) fail("pass exactly one SQL statement as a single quoted argument.");
  // Even a refused write attempt is still an attempt against production.
  if (grantCheck && target === "oracle") fail("--grant-check is local-only — never send write statements to Oracle.");
  return { target: target as "local" | "oracle", grantCheck, sql: rest[0] };
}

function resolveUrl(target: "local" | "oracle"): string {
  const envName = target === "local" ? "DATABASE_URL_READONLY" : "ORACLE_DATABASE_URL_READONLY";
  const url = process.env[envName];
  if (!url) fail(`${envName} is not set.`);
  const parsed = new URL(url);
  const user = decodeURIComponent(parsed.username);
  if (user !== READ_ONLY_USER) fail(`${envName} is not the ${READ_ONLY_USER} user — refusing to connect.`);
  const isLocalHost = LOCAL_HOSTS.has(parsed.hostname);
  if (target === "local" && !isLocalHost) fail(`${envName} doesn't point at localhost — refusing (.env may be switched to Oracle).`);
  if (target === "oracle" && isLocalHost) fail(`${envName} points at localhost, not Oracle.`);
  return url;
}

async function main() {
  const { target, grantCheck, sql } = parseArgs(process.argv.slice(2));
  const trimmed = sql.trim().replace(/;\s*$/, "");
  if (!grantCheck) {
    if (!ALLOWED_STATEMENT.test(trimmed)) fail("only SELECT/WITH/EXPLAIN/SHOW/DESCRIBE statements are allowed.");
    if (trimmed.includes(";")) fail("one statement per call.");
  }

  // buildConnectionConfig is typed for the Prisma adapter (pool config | URL
  // string) but always returns a plain object, which is valid here too.
  const config = buildConnectionConfig(resolveUrl(target)) as ConnectionConfig;
  let conn: Connection;
  try {
    // allowPublicKeyRetrieval: local MySQL 8's caching_sha2_password over
    // plain TCP needs it (Oracle gets it from buildConnectionConfig's ssl path).
    conn = await mariadb.createConnection({ ...config, allowPublicKeyRetrieval: true, connectTimeout: 15_000 });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    fail(`connection to ${target} failed: ${e.code ?? ""} ${e.message ?? String(error)}`);
  }
  try {
    if (!grantCheck) await conn.query("SET SESSION TRANSACTION READ ONLY");
    const [{ who }] = await conn.query("SELECT CURRENT_USER() AS who");
    const started = performance.now();
    const rows = await conn.query(trimmed);
    const elapsedMs = Math.round(performance.now() - started);
    console.log(`-- target=${target} user=${who} elapsed=${elapsedMs}ms`);
    console.log(
      JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)
    );
  } catch (error) {
    const e = error as { code?: string; errno?: number; sqlMessage?: string; message?: string };
    console.error(`-- target=${target} query failed: ${e.code ?? ""} (${e.errno ?? "?"}) ${e.sqlMessage ?? e.message}`);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
