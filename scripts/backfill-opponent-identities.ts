// One-time backfill: populates PlayerIdentity rows for every opponent
// already present in already-ingested Decision data, for matches synced
// before lib/ingest.ts started upserting opponent identities as part of
// normal detail-ingest. Safe to re-run (upsert-based, idempotent) — e.g. if
// run again after more matches have been backfilled.
//
// Usage: npx tsx scripts/backfill-opponent-identities.ts
import "dotenv/config";
import { prisma } from "@/lib/prisma";

const SOURCE = "galaxy";

interface MatchUserRow {
  matchId: number;
  userId: string;
}

async function main() {
  const me = await prisma.playerIdentity.findFirst({ where: { source: SOURCE, isMe: true } });
  if (!me) {
    throw new Error(
      `No "you" PlayerIdentity row found (source: "${SOURCE}", isMe: true) — visit /galaxy/matches once, or run a sync, before backfilling opponents.`
    );
  }
  console.log(`"You": sourceUserId=${me.sourceUserId} displayName=${me.displayName}`);

  // Distinct (matchId, userId) pairs — far smaller than the full Decision
  // table (thousands of matches x ~2 users each, not 1M+ decision rows).
  const pairs = await prisma.$queryRaw<MatchUserRow[]>`
    SELECT g.matchId AS matchId, d.userId AS userId
    FROM Decision d
    JOIN Game g ON d.gameId = g.id
    GROUP BY g.matchId, d.userId
  `;
  console.log(`Distinct (matchId, userId) pairs: ${pairs.length}`);

  const matches = await prisma.match.findMany({
    select: { id: true, opponentName: true, playedAt: true, createdAt: true },
  });
  const matchById = new Map(matches.map((m) => [m.id, m]));

  // For each opponent userId, track the entry from the most recently played
  // match (falling back to createdAt if playedAt is null) — an opponent's
  // display name can change between matches, and picking arbitrarily (e.g.
  // "last one processed") would silently pick an unpredictable one instead.
  const bestByUserId = new Map<string, { opponentName: string; at: Date }>();

  for (const { matchId, userId } of pairs) {
    if (userId === me.sourceUserId) continue;

    const match = matchById.get(matchId);
    if (!match) continue; // shouldn't happen (FK-backed), skip defensively

    const at = match.playedAt ?? match.createdAt;
    const current = bestByUserId.get(userId);
    if (!current || at > current.at) {
      bestByUserId.set(userId, { opponentName: match.opponentName, at });
    }
  }

  console.log(`Distinct opponent userIds: ${bestByUserId.size}`);

  const existingBefore = new Set(
    (await prisma.playerIdentity.findMany({ where: { source: SOURCE }, select: { sourceUserId: true } })).map(
      (r) => r.sourceUserId
    )
  );

  let created = 0;
  let updated = 0;

  for (const [userId, { opponentName }] of bestByUserId) {
    await prisma.playerIdentity.upsert({
      where: { source_sourceUserId: { source: SOURCE, sourceUserId: userId } },
      create: { source: SOURCE, sourceUserId: userId, displayName: opponentName, isMe: false },
      update: { displayName: opponentName },
    });
    if (existingBefore.has(userId)) {
      updated++;
    } else {
      created++;
    }
  }

  console.log(`Done. Created ${created} new opponent PlayerIdentity rows, updated ${updated} existing ones.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
