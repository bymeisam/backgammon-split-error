// Seeds the local `bg_test` MySQL schema (see e2e/README.md) with exactly
// the rows the /mistakes visual-regression tests need: 1 Match, 3 Games,
// and 10 Decisions — the 5 representative decisions already used in
// board-visual.spec.ts, plus each one's immediately preceding dice_rolled
// sibling row. Those siblings are kept for historical/snapshot fidelity
// (this is a real one-time capture, not hand-assembled), but nothing reads
// them as siblings anymore — roll, cubeOwnerUserId, cubeValue, and
// cubeConfident are all plain columns on each row directly now (see
// reports/2026-10-02-step4-dice-roll-column-design.md and reports/2026-10-
// 02-step5-cube-value-confident-design.md). Deliberately not a full
// match/account replica, just what these 5 tests actually render.
//
// Source data: e2e/fixtures/seed-data.json — a real, one-time snapshot of
// these exact rows (opponent name anonymized), not re-derived or
// hand-typed, so field values match what the app itself would have
// produced via lib/ingest.ts — except sourcePositionId/roll/cubeOwnerUserId/
// cubeValue/cubeConfident/cubeActionPlayed/cubeActionBest, added after the
// fact (2026-10-02) once those became real columns (or, for
// movePlayed/moveBest, renamed from notationPlayed/notationBest, same
// date): computed directly from each row's own raw/sibling context, not
// hand-typed either.
//
// Standalone by design: builds its own MySQL connection directly from
// .env.test rather than importing lib/prisma.ts (which throws at import
// time if the real .env's DATABASE_URL happens to be unset, and always
// prefers process.env over an explicit path) — this script never depends
// on the real .env's state at all.
//
// Usage: npx tsx e2e/seed-test-db.ts   (idempotent — safe to re-run)
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../lib/generated/prisma/client";

interface SeedDecision {
  id: number;
  gameIndex: number;
  eventId: string;
  timestamp: string;
  raw: unknown;
  [key: string]: unknown;
}

interface SeedData {
  match: {
    source: string;
    sourceMatchId: string;
    matchLength: number | null;
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
  games: { gameIndex: number; playedAt: string | null }[];
  decisions: SeedDecision[];
}

async function main() {
  const envPath = path.join(__dirname, "..", ".env.test");
  const testEnv = dotenv.parse(fs.readFileSync(envPath, "utf8"));
  const url = new URL(testEnv.DATABASE_URL);

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
      create: { matchId: match.id, gameIndex: g.gameIndex, playedAt: g.playedAt ? new Date(g.playedAt) : null },
      update: { playedAt: g.playedAt ? new Date(g.playedAt) : null },
    });
    gameIdByIndex.set(g.gameIndex, game.id);
  }

  for (const d of seed.decisions) {
    const gameId = gameIdByIndex.get(d.gameIndex);
    if (!gameId) throw new Error(`No seeded game for gameIndex ${d.gameIndex} (decision ${d.id})`);

    const { id, gameIndex, gameId: _staleGameId, eventId, timestamp, raw, ...rest } = d;
    void gameIndex;
    void _staleGameId;
    const data: Record<string, unknown> = {
      ...rest,
      gameId,
      eventId: BigInt(eventId),
      timestamp: new Date(timestamp),
      raw,
    };

    await prisma.decision.upsert({
      where: { gameId_eventId: { gameId, eventId: BigInt(eventId) } },
      create: { id, ...data } as never,
      update: data as never,
    });
  }

  console.log(
    `Seeded bg_test: 1 match, ${seed.games.length} games, ${seed.decisions.length} decisions (match ${seed.match.sourceMatchId}).`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
