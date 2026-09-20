import type { ReactNode } from "react";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { STATUS_NOTES } from "./notes";

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
  const url = process.env.DATABASE_URL;
  const engine = url ? new URL(url).protocol.replace(":", "") : "unknown";

  const adapter = new PrismaMariaDb(url as string);
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
    return {
      engine,
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
      latestMigration: null,
      counts: null,
    };
  } finally {
    await prisma.$disconnect();
  }
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-black/5 py-2 text-sm last:border-b-0 dark:border-white/10">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="font-mono text-black dark:text-zinc-100">{value}</span>
    </div>
  );
}

export default async function StatusPage() {
  const db = await getDbStatus();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Status
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Live stack/DB snapshot. Versions and counts below are read directly from
            package.json and the database on every load — nothing here is manually
            maintained except the notes at the bottom.
          </p>
        </div>

        <section className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Stack
          </h2>
          <Row label="Next.js" value={nextPkg.version} />
          <Row label="React" value={reactPkg.version} />
          <Row label="TypeScript" value={typescriptPkg.version} />
          <Row label="Prisma CLI" value={prismaPkg.version} />
          <Row label="@prisma/client" value={prismaClientPkg.version} />
          <Row label="Node.js" value={process.version} />
        </section>

        <section className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Database
          </h2>
          <Row label="Engine" value={db.engine} />
          <Row
            label="Connection"
            value={
              <span className={db.connected ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
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

        <section className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-zinc-900">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Notes
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-black dark:text-zinc-100">
            {STATUS_NOTES.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
