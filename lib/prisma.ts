import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/lib/generated/prisma/client";
import fs from "node:fs";
import path from "node:path";
import { isCertVerificationError, ORACLE_CERT_FAILURE_HINT } from "@/lib/oracleCertCheck";

// @prisma/adapter-mariadb bundles its own copy of the `mariadb` package
// (distinct from the top-level one), so its PoolConfig type must come from
// here — importing "mariadb" directly gives a structurally-incompatible
// duplicate. Derived via ConstructorParameters rather than a deep import
// into node_modules/@prisma/adapter-mariadb/node_modules/mariadb.
type MariaDbConnectionConfig = ConstructorParameters<typeof PrismaMariaDb>[0];

// Oracle HeatWave issues its own private CA for this DB endpoint (not a
// publicly-trusted one), so Node's default TLS verification rejects it as
// "self-signed certificate in certificate chain". Pinning the CA here gives
// real certificate validation against that specific CA instead of disabling
// verification. Fetched directly from the server's TLS handshake
// (`openssl s_client -starttls mysql`) — safe to commit, it's a public cert.
// SHA256 fingerprint (cross-check against the Oracle console if in doubt):
// C3:BD:54:50:F7:AD:34:0A:13:AF:B9:99:FE:D5:C1:BB:5C:BF:80:48:D8:2C:9E:D7:61:FC:90:E9:A9:0E:3A:59
//
// HeatWave rotates this CA periodically (confirmed 2026-10-02: the
// previously-pinned CA, issued 2026-09-22, stopped verifying — the live
// endpoint had rotated to a new self-signed CA issued 2026-09-29, one week
// later — causing every real Oracle connection to fail with
// CERT_SIGNATURE_FAILURE until this file was refreshed to match). If this
// starts failing again, re-fetch and re-pin the same way: `openssl s_client
// -connect <host>:3306 -starttls mysql -showcerts` against the real
// endpoint, take the self-signed (`issuer == subject`) cert from the chain
// (index 1, not the leaf server cert at index 0), and verify it offline
// first with `openssl verify -CAfile <new-cert> <new-cert>` before
// replacing this file — don't disable TLS verification as a workaround.
const ORACLE_CA_PATH = path.join(process.cwd(), "certs", "oracle-mysql-ca.pem");

// PrismaMariaDb's `ssl=true` query param alone maps to boolean `ssl: true`,
// which uses Node's default (publicly-trusted-CA-only) verification and
// fails against Oracle's private CA. Parsing the URL ourselves lets us swap
// in `ssl: { ca }` for real validation against our pinned cert instead —
// only when the URL actually requests SSL (i.e. never for local dev, which
// has no query params on its DATABASE_URL).
export function buildConnectionConfig(url: string): MariaDbConnectionConfig {
  const parsed = new URL(url);
  const config: Record<string, unknown> = {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  };

  // Serverless instances multiply connections (each warm Lambda instance
  // holds its own pool), and Oracle HeatWave's Always Free tier caps total
  // concurrent connections low. mariadb's own default (10 per pool, see
  // node_modules/mariadb/lib/config/pool-options.js) was never overridden
  // here, so each of this file's two pools (prisma, prismaReadOnly) — times
  // however many concurrent serverless instances Vercel spins up — could
  // multiply into the dozens/hundreds. A small fixed cap keeps any single
  // instance's footprint tiny; the mariadb driver queues excess concurrent
  // queries against a full pool rather than failing them, so this is a
  // throughput/latency tradeoff, not a correctness one, and safe even for
  // /status's own 5-way Promise.all.
  config.connectionLimit = 3;

  if (parsed.searchParams.get("ssl") === "true") {
    config.ssl = {
      ca: fs.readFileSync(ORACLE_CA_PATH),
      // The mariadb driver's TLS handshake code never forwards `host` into
      // the underlying `tls.connect()` call, so Node's default hostname
      // check compares against 'localhost' and fails. Even fixed, it still
      // wouldn't match: Oracle's cert has no SAN and its CN
      // ("MySQL_Endpoint_Server") isn't the IP we connect by. Skip only the
      // hostname match — chain-of-trust validation against the pinned CA
      // above still fully applies, so a rogue/unsigned cert is still
      // rejected; only "does the name on the cert match the address I
      // dialed" (meaningless here) is skipped. (checkServerIdentity works
      // at runtime — the driver reads it directly — but isn't in its .d.ts,
      // hence the cast below.)
      checkServerIdentity: () => undefined,
    };
    config.allowPublicKeyRetrieval = true;
  }

  return config as MariaDbConnectionConfig;
}

// Wraps every query made through a client with this extension in a
// diagnostic check: if the failure looks like a TLS chain-of-trust failure
// against the pinned Oracle CA (see lib/oracleCertCheck.ts — this is the
// one signal Prisma's own `.code` can't tell you, since it surfaces as a
// generic "pool timeout" with the real cause buried deep in `.meta`),
// log a clear, actionable hint before rethrowing the original error
// unchanged. Purely additive — no caller's existing catch/retry behavior
// changes, this only adds a console line pointing at the real cause.
// Applied to both `prisma`/`prismaReadOnly` below, so it covers everything
// that goes through either shared client (ingest, sync, every page/route
// that reads/writes via them) — not just the few call sites that happen to
// check for this explicitly (app/status/page.tsx, lib/sync.ts).
function withOracleCertCheck(client: PrismaClient): PrismaClient {
  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (error) {
          if (isCertVerificationError(error)) {
            console.error(`[prisma] ${ORACLE_CERT_FAILURE_HINT}`);
          }
          throw error;
        }
      },
    },
  }) as unknown as PrismaClient;
}

// Two separate clients, each scoped to the minimum privilege its callers
// actually need — see docs/field-mapping.md's "Credential scoping" section
// for the full call-site list and rationale.
//
//   prisma          -> DATABASE_URL. Read-write/admin (bg_db_rw in
//                      production) — ingest (lib/ingest.ts), sync
//                      (lib/sync.ts, scripts/backfill.ts,
//                      scripts/incremental-sync.ts, /api/sync/incremental),
//                      and `prisma migrate deploy` itself all read this same
//                      var. Migrations need CREATE/ALTER/INDEX/REFERENCES
//                      beyond plain app read-write, so this intentionally
//                      stays on full admin credentials rather than a
//                      narrower app-only read-write user.
//   prismaReadOnly  -> DATABASE_URL_READONLY. SELECT-only (bg_db_ro in
//                      production) — anything that only ever queries:
//                      lib/local-client.ts, app/api/player-identities,
//                      app/status, and future read-only diagnostic scripts.
//
// A single helper builds both, so the two don't duplicate the
// adapter/client construction boilerplate.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaReadOnly?: PrismaClient;
};

// Lazy on purpose: this module is imported by anything that touches either
// client, including files that only ever use prismaReadOnly (e.g.
// lib/local-client.ts, app/status/page.tsx, app/api/player-identities). ES
// module evaluation runs every top-level statement in a file regardless of
// which export the importer actually uses, so an eager `new PrismaClient(...)`
// here for `prisma` would throw the instant DATABASE_URL is unset — which is
// the normal, expected state in production/preview (only DATABASE_URL_READONLY
// is set there; see docs/deploy.md) and in CI (no real DB credentials at all,
// see .github/workflows/ci.yml). A Proxy defers both the env-var check and
// the actual PrismaClient/pool construction until the first real property
// access (e.g. `prisma.match.findMany`), so importing this module — or even
// importing `prisma` without ever calling a method on it — never throws.
// Real usage of an unconfigured client still throws immediately and loudly;
// nothing about the write client actually
// being used without DATABASE_URL is silently tolerated.
function createLazyClient(url: string | undefined, envVarName: string): PrismaClient {
  let client: PrismaClient | undefined;
  function get(): PrismaClient {
    if (!client) {
      if (!url) {
        throw new Error(`${envVarName} is not set — see .env.example.`);
      }
      client = withOracleCertCheck(
        new PrismaClient({ adapter: new PrismaMariaDb(buildConnectionConfig(url)) })
      );
    }
    return client;
  }
  // No `receiver` passed to Reflect.get — forwards `this` as the real client,
  // not the proxy, so internal getter-based APIs (Prisma's model delegates,
  // $transaction, etc.) see the object shape they expect.
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      return Reflect.get(get(), prop);
    },
  });
}

export const prisma =
  globalForPrisma.prisma ?? createLazyClient(process.env.DATABASE_URL, "DATABASE_URL");

export const prismaReadOnly =
  globalForPrisma.prismaReadOnly ??
  createLazyClient(process.env.DATABASE_URL_READONLY, "DATABASE_URL_READONLY");

// Standard Next.js dev singleton: without this, hot reload creates new
// PrismaClients (and connection pools) on every edit.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaReadOnly = prismaReadOnly;
}
