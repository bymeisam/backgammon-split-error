// Seeds the local `bg_test` MySQL schema (see e2e/README.md) with exactly
// the rows the visual-regression tests need: 1 Match, 3 Games, and 11
// Decision rows — the 10 real fixture rows (5 representative decisions and
// their immediately preceding dice_rolled siblings) plus one test-only
// duplicate CHECKER occurrence that gives the repeated-position drilldown
// a deterministic two-occurrence group. The 10 fixture rows are a real
// one-time capture, not hand-assembled; nothing reads the sibling rows as
// siblings: roll, cube, colour and labels all come from each row's own raw
// (its GNU Match ID and review; lib/analysis/index.ts). Deliberately not a
// full match/account replica, just what the visual tests actually render.
//
// Source data: e2e/fixtures/seed-data.json — a real, one-time snapshot of
// these exact rows (opponent name anonymized), not re-derived or
// hand-typed, so field values match what the app itself would have
// produced via lib/ingest.ts. It holds only the columns the schema still
// has: since 2026-10-07 the values derivable from raw (colour, event type,
// roll, cube, labels, resignation detail, luck/equity, timestamp; Game's
// scores/Crawford/playedAt; Match.matchLength) are no longer columns, and
// were removed from the snapshot (reports/2026-10-07-column-audit.md).
// sourcePositionId was added after the fact (2026-10-02), computed from
// each row's own raw.
//
// Standalone by design: builds its own MySQL connection directly from
// .env.test rather than importing lib/prisma.ts (which reads process.env,
// i.e. the real .env) — this script never depends on the real .env's state
// at all. It reads .env.test's LOCAL_* URL through lib/databaseUrl.ts's
// localDbUrl, and refuses anything but localhost.
//
// Usage: npx tsx e2e/seed-test-db.ts   (idempotent — safe to re-run)
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../lib/generated/prisma/client";
import { DB_URL_VARS, isLocalDatabaseUrl, localDbUrl } from "../lib/databaseUrl";

interface SeedDecision {
  id: number;
  gameIndex: number;
  eventId: string;
  raw: unknown;
  [key: string]: unknown;
}

interface SeedData {
  match: {
    source: string;
    sourceMatchId: string;
    opponentName: string;
    opponentCountry: string;
    opponentRating: number;
    opponentError: number;
    opponentScore: number;
    userError: number;
    userRating: number;
    userScore: number;
    playedAt: string | null;
    ingestStatus: string;
  };
  games: { gameIndex: number }[];
  decisions: SeedDecision[];
}

async function main() {
  const envPath = path.join(__dirname, "..", ".env.test");
  const testEnv = dotenv.parse(fs.readFileSync(envPath, "utf8"));
  const rawUrl = localDbUrl("rw", testEnv);
  if (!rawUrl || !isLocalDatabaseUrl(rawUrl)) {
    throw new Error(`.env.test: ${DB_URL_VARS.local.rw} must be set and point at localhost (bg_test).`);
  }
  const url = new URL(rawUrl);

  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb({
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
    } as ConstructorParameters<typeof PrismaMariaDb>[0]),
  });

  const seedPath = path.join(__dirname, "fixtures", "seed-data.json");
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8")) as SeedData;

  const match = await prisma.match.upsert({
    where: {
      source_sourceMatchId: { source: seed.match.source, sourceMatchId: seed.match.sourceMatchId },
    },
    create: {
      ...seed.match,
      playedAt: seed.match.playedAt ? new Date(seed.match.playedAt) : null,
      ingestStatus: seed.match.ingestStatus as never,
    },
    update: {
      ...seed.match,
      playedAt: seed.match.playedAt ? new Date(seed.match.playedAt) : null,
      ingestStatus: seed.match.ingestStatus as never,
    },
  });

  const gameIdByIndex = new Map<number, number>();
  for (const g of seed.games) {
    const game = await prisma.game.upsert({
      where: { matchId_gameIndex: { matchId: match.id, gameIndex: g.gameIndex } },
      create: { matchId: match.id, gameIndex: g.gameIndex },
      update: {},
    });
    gameIdByIndex.set(g.gameIndex, game.id);
  }

  for (const d of seed.decisions) {
    const gameId = gameIdByIndex.get(d.gameIndex);
    if (!gameId) throw new Error(`No seeded game for gameIndex ${d.gameIndex} (decision ${d.id})`);

    const { id, gameIndex, gameId: _staleGameId, eventId, raw, ...rest } = d;
    void gameIndex;
    void _staleGameId;
    const data: Record<string, unknown> = {
      ...rest,
      gameId,
      eventId: BigInt(eventId),
      raw,
    };

    await prisma.decision.upsert({
      where: { gameId_eventId: { gameId, eventId: BigInt(eventId) } },
      create: { id, ...data } as never,
      update: data as never,
    });
  }

  // A second occurrence of a real seeded CHECKER decision makes the
  // repeated-position drilldown deterministic without adding another raw
  // payload. The extra row is test-only; it shares the source board and
  // severity, with a matching two-occurrence aggregate.
  const staleSource = seed.decisions.find((decision) => decision.kind === "CHECKER" && decision.errorSeverity === "ERROR");
  if (!staleSource) throw new Error("No seeded ERROR checker decision for stale fixture cleanup");
  const repeatedId = Math.max(...seed.decisions.map(({ id }) => id)) + 1;
  const staleGameId = gameIdByIndex.get(staleSource.gameIndex);
  if (!staleGameId) throw new Error("No seeded game for stale repeated-position fixture cleanup");
  await prisma.decision.deleteMany({
    where: { id: repeatedId, gameId: staleGameId, eventId: BigInt(staleSource.eventId) + 1n },
  });
  const repeatedSource = seed.decisions.find((decision) => decision.kind === "CHECKER" && decision.classification === "race" && decision.errorSeverity === "DOUBTFUL");
  if (!repeatedSource) throw new Error("No seeded race/doubtful checker decision for the repeated-position fixture");
  const repeatedSourceRow = await prisma.decision.findUniqueOrThrow({ where: { id: repeatedSource.id } });
  if (!repeatedSourceRow.sourcePositionId) throw new Error("Repeated-position fixture source has no sourcePositionId");
  const repeatedEventId = BigInt(repeatedSource.eventId) + 1n;
  await prisma.decision.upsert({
    where: { gameId_eventId: { gameId: repeatedSourceRow.gameId, eventId: repeatedEventId } },
    create: { ...repeatedSourceRow, id: repeatedId, eventId: repeatedEventId } as never,
    update: {},
  });
  const repeatedWhere = {
    sourcePositionId: repeatedSourceRow.sourcePositionId,
    errorSeverity: repeatedSourceRow.errorSeverity,
    plyNumber: repeatedSourceRow.plyNumber,
  };
  const repeatedAggregate = await prisma.repeatedPosition.findFirst({ where: repeatedWhere });
  const repeatedAggregateData = {
    sourcePositionId: repeatedSourceRow.sourcePositionId,
    classification: repeatedSourceRow.classification,
    errorSeverity: repeatedSourceRow.errorSeverity,
    plyNumber: repeatedSourceRow.plyNumber,
    occurrenceCount: 2,
    computedAt: new Date(),
  };
  if (repeatedAggregate) {
    await prisma.repeatedPosition.update({ where: { id: repeatedAggregate.id }, data: repeatedAggregateData });
  } else {
    await prisma.repeatedPosition.create({ data: repeatedAggregateData });
  }

  console.log(
    `Seeded bg_test: 1 match, ${seed.games.length} games, ${seed.decisions.length + 1} decisions (match ${seed.match.sourceMatchId}).`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
