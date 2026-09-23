import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/lib/generated/prisma/client";
import fs from "node:fs";
import path from "node:path";

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
// DE:41:47:94:76:AE:E0:B9:0A:F1:8F:C2:03:8B:57:1F:BB:D0:71:6A:D2:25:DF:34:CB:B9:CB:2D:E6:29:C3:AA
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

// Two separate clients, each scoped to the minimum privilege its callers
// actually need — see docs/field-mapping.md's "Credential scoping" section
// for the full call-site list and rationale.
//
//   prisma          -> DATABASE_URL. Read-write/admin (bg_readwrite in
//                      production) — ingest (lib/ingest.ts), sync
//                      (lib/sync.ts, scripts/backfill.ts,
//                      scripts/incremental-sync.ts, /api/sync/incremental),
//                      and `prisma migrate deploy` itself all read this same
//                      var. Migrations need CREATE/ALTER/INDEX/REFERENCES
//                      beyond plain app read-write, so this intentionally
//                      stays on full admin credentials rather than a
//                      narrower app-only read-write user.
//   prismaReadOnly  -> DATABASE_URL_READONLY. SELECT-only (bg_readonly in
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

function createClient(url: string | undefined, envVarName: string): PrismaClient {
  if (!url) {
    throw new Error(`${envVarName} is not set — see .env.example.`);
  }
  return new PrismaClient({ adapter: new PrismaMariaDb(buildConnectionConfig(url)) });
}

export const prisma =
  globalForPrisma.prisma ?? createClient(process.env.DATABASE_URL, "DATABASE_URL");

export const prismaReadOnly =
  globalForPrisma.prismaReadOnly ??
  createClient(process.env.DATABASE_URL_READONLY, "DATABASE_URL_READONLY");

// Standard Next.js dev singleton: without this, hot reload creates new
// PrismaClients (and connection pools) on every edit.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaReadOnly = prismaReadOnly;
}
