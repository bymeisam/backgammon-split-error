import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/lib/generated/prisma/client";

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
  return new PrismaClient({ adapter: new PrismaMariaDb(url) });
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
