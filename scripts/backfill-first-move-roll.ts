// One-time backfill: fills in Decision.roll for a game's genuinely first
// stored decision, where it's null today not because the data doesn't
// exist but because scripts/backfill-decision-roll.ts (and the read-time
// logic it replaced) could only ever see already-stored Decision rows —
// and Galaxy's game_started event, which can carry the real opening roll,
// is never stored as its own row (lib/ingest.ts's NON_DECISION_EVENT_TYPES
// excludes it before anything in it is examined).
//
// Confirmed this wasn't actually unmeasurable (the original, now-corrected
// claim in reports/2026-10-02-step4-dice-roll-column-design.md) by
// independently checking Galaxy's own live site against two real matches:
// both had a real, non-empty rolled_dice on game_started, exactly matching
// the pip math of the first move actually played.
//
// Rather than needing game_started's rolled_dice at all, every first-move
// Decision row already has what's needed, already stored: raw.moves, a
// flat [from1, to1, from2, to2, ...] array Galaxy sends on every
// move_commited event (one [from, to] pair per die used) — decoded via
// lib/mistakes.ts's decodeRollFromMoves (see its own comment for the full
// reliability story: ~6% mismatch rate in general, entirely from bear-off/
// bar-entry cases that can't happen on a game's first move, so 100%
// reliable for exactly this population — verified against all 15,550
// affected rows before writing this script, and spot-checked against two
// Galaxy-site-confirmed real examples).
//
// Unlike scripts/backfill-decision-roll.ts, this needs no cross-row game
// context at all — each row's own raw.moves is self-sufficient — and the
// target population is small (a few tens of thousands of rows, not the
// whole table), so a single flat query is safe with no OOM risk the way
// pulling the whole table's raw JSON at once would be (see scripts/
// backfill-source-position-id.ts's history for why that distinction
// matters).
//
// Usage:
//   npx tsx scripts/backfill-first-move-roll.ts --dry-run   # compute + log only
//   npx tsx scripts/backfill-first-move-roll.ts             # actually write
//
// Runs against whatever DATABASE_URL is currently configured in .env.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import type { GameEvent } from "@/lib/gameReviewsTypes";
import { decodeRollFromMoves } from "@/lib/mistakes";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(DRY_RUN ? "DRY RUN — computing only, nothing will be written.\n" : "LIVE RUN — will write changes.\n");

  // Exactly the population identified and verified in the design
  // conversation: a game's first stored decision, CHECKER kind, still
  // null. Scoping to "first stored decision of the game" (not just "roll
  // IS NULL") is deliberate — it excludes the other two null-roll
  // categories (a dice_rolled event's own cube-check row; a RESIGNATION/
  // CUBE decision with genuinely no roll), which this fix doesn't apply to.
  const candidates: { id: number; raw: unknown }[] = await prisma.$queryRawUnsafe(`
    SELECT d.id, d.raw
    FROM Decision d
    WHERE d.kind = 'CHECKER'
      AND d.roll IS NULL
      AND d.eventId = (SELECT MIN(d2.eventId) FROM Decision d2 WHERE d2.gameId = d.gameId)
  `);
  console.log(`Candidate first-move decisions: ${candidates.length}`);

  const idsByRoll = new Map<string, { ids: number[]; roll: number[] }>();
  let resolved = 0;
  let unresolved = 0;

  for (const row of candidates) {
    const event = row.raw as unknown as GameEvent;
    const roll = decodeRollFromMoves(event.moves);
    if (roll === null) {
      unresolved++;
      continue;
    }
    resolved++;
    const key = JSON.stringify(roll);
    const bucket = idsByRoll.get(key) ?? { ids: [], roll };
    bucket.ids.push(row.id);
    idsByRoll.set(key, bucket);
  }

  console.log(`Resolvable from raw.moves: ${resolved} (${idsByRoll.size} distinct roll values)`);
  console.log(`Unresolvable (not a clean 2+ hop decode — shouldn't happen for this population): ${unresolved}\n`);

  if (!DRY_RUN) {
    for (const { ids, roll } of idsByRoll.values()) {
      await prisma.decision.updateMany({ where: { id: { in: ids } }, data: { roll } });
      console.log(`Set roll = ${JSON.stringify(roll)} on ${ids.length} decisions`);
    }
  }

  const remainingNull = DRY_RUN
    ? unresolved
    : await prisma.$queryRawUnsafe<{ c: bigint }[]>(`
        SELECT COUNT(*) AS c FROM Decision d
        WHERE d.kind = 'CHECKER' AND d.roll IS NULL
          AND d.eventId = (SELECT MIN(d2.eventId) FROM Decision d2 WHERE d2.gameId = d.gameId)
      `).then((r) => Number(r[0].c));

  console.log("\n=== Summary ===");
  console.log(DRY_RUN ? "(dry run — nothing was written)" : "(live run — changes above were written)");
  console.log(`Candidates: ${candidates.length} total, ${resolved} resolved, ${unresolved} unresolved`);
  console.log(`First-move roll still null after this run: ${remainingNull} (expected: ${unresolved})`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
