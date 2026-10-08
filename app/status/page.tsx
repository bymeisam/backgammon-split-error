import type { ReactNode } from "react";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { buildConnectionConfig } from "@/lib/prisma";
import { isCertVerificationError, ORACLE_CERT_FAILURE_HINT } from "@/lib/oracleCertCheck";
import PageShell from "@/app/components/ui/PageShell";
import { STATUS_NOTES } from "./notes";
import { style } from "./status.styles";

import nextPkg from "next/package.json";
import reactPkg from "react/package.json";
import typescriptPkg from "typescript/package.json";
import prismaPkg from "prisma/package.json";
import prismaClientPkg from "@prisma/client/package.json";

export const dynamic = "force-dynamic";

interface DbStatus {
  engine: string;
  connected: boolean;
  error: string | null;
  latestMigration: string | null;
  counts: { match: number; game: number; decision: number; playerIdentity: number } | null;
}

async function getDbStatus(): Promise<DbStatus> {
  // Read-only client — this page only ever queries (row counts, connection
  // check, latest migration name), never writes. Intentionally builds its
  // own short-lived client rather than importing the shared singleton from
  // lib/prisma.ts, so a status check can't be misled by the shared pool's
  // own state.
  const url = process.env.DATABASE_URL_READONLY;
  const engine = url ? new URL(url).protocol.replace(":", "") : "unknown";

  // buildConnectionConfig (from lib/prisma.ts) pins Oracle's private CA for
  // SSL connections — a bare `new PrismaMariaDb(url)` would fail TLS
  // verification against it. Reusing the helper, not the shared client.
  const adapter = new PrismaMariaDb(buildConnectionConfig(url as string));
  const prisma = new PrismaClient({ adapter });

  try {
    const [migrations, matchCount, gameCount, decisionCount, playerIdentityCount] =
      await Promise.all([
        prisma.$queryRaw<
          { migration_name: string }[]
        >`SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1`,
        prisma.match.count(),
        prisma.game.count(),
        prisma.decision.count(),
        prisma.playerIdentity.count(),
      ]);

    return {
      engine,
      connected: true,
      error: null,
      latestMigration: migrations[0]?.migration_name ?? null,
      counts: {
        match: matchCount,
        game: gameCount,
        decision: decisionCount,
        playerIdentity: playerIdentityCount,
      },
    };
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unknown error";
    // isCertVerificationError catches exactly the failure mode that broke
    // this app's real Oracle connection 2026-10-02 (a HeatWave CA rotation)
    // — Prisma's own raw message for that case is a generic, misleading
    // "pool timeout", so the clear hint is prepended rather than left for
    // someone to re-diagnose from scratch (see lib/oracleCertCheck.ts).
    // Row renders this as a single flowing line (no whitespace-pre-line
    // anywhere in status.styles.ts), so this stays one sentence rather than
    // relying on a line break that wouldn't actually render.
    const displayMessage = isCertVerificationError(error)
      ? `${ORACLE_CERT_FAILURE_HINT} Raw error: ${rawMessage}`
      : rawMessage;
    return {
      engine,
      connected: false,
      error: displayMessage,
      latestMigration: null,
      counts: null,
    };
  } finally {
    await prisma.$disconnect();
  }
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={style.rowWrapper}>
      <span className={style.rowLabel}>{label}</span>
      <span className={style.rowValue}>{value}</span>
    </div>
  );
}

export default async function StatusPage() {
  const db = await getDbStatus();

  return (
    <PageShell
      width="narrow"
      title="Status"
      subtitle={
        <>
          Live stack/DB snapshot. Versions and counts below are read directly from
          package.json and the database on every load — nothing here is manually
          maintained except the notes at the bottom.
        </>
      }
    >
      <section className={style.section}>
        <h2 className={style.sectionTitle}>
          Stack
        </h2>
        <Row label="Next.js" value={nextPkg.version} />
        <Row label="React" value={reactPkg.version} />
        <Row label="TypeScript" value={typescriptPkg.version} />
        <Row label="Prisma CLI" value={prismaPkg.version} />
        <Row label="@prisma/client" value={prismaClientPkg.version} />
        <Row label="Node.js" value={process.version} />
      </section>

      <section className={style.section}>
        <h2 className={style.sectionTitle}>
          Database
        </h2>
        <Row label="Engine" value={db.engine} />
        <Row
          label="Connection"
          value={
            <span className={style.connectionStatus(db.connected)}>
              {db.connected ? "OK" : "FAILED"}
            </span>
          }
        />
        {db.error && <Row label="Error" value={db.error} />}
        <Row label="Latest migration" value={db.latestMigration ?? "—"} />
        {db.counts && (
          <>
            <Row label="Matches" value={db.counts.match} />
            <Row label="Games" value={db.counts.game} />
            <Row label="Decisions" value={db.counts.decision} />
            <Row label="Player identities" value={db.counts.playerIdentity} />
          </>
        )}
      </section>

      <section className={style.section}>
        <h2 className={style.sectionTitle}>
          Notes
        </h2>
        <ul className={style.notesList}>
          {STATUS_NOTES.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
