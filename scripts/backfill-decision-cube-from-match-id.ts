// Backfill: recomputes Decision.cubeValue/cubeOwnerUserId/cubeConfident for
// every already-ingested row from the row's own GNU Match ID
// (raw.reviews[0].source_match.formatted_value), the same rule lib/ingest.ts
// uses since 2026-10-06 — replacing the retired take-walk (the deleted
// scripts/backfill-decision-cube-state.ts), which missed takes on ~22% of
// rows and flagged them cubeConfident = 0. See docs/field-mapping.md,
// "GNU Match ID".
//
// Rule (lib/gnuMatchId.ts, one source of truth with ingest):
//   cubeValue       = the Match ID's cube value
//   cubeOwnerUserId = the userId in the cube-owner seat (black = player 1,
//                     white = player 0), null when centred. Seats come from
//                     the match's own rows (addSeatEvidence: each row's
//                     colour where set, else the Match ID's dice owner for a
//                     move / turn for a cube decision).
//   cubeConfident   = true, unless the Match ID doesn't decode or the owner
//                     seat maps to no userId — then all three are null/false.
//
// No live Galaxy calls. Memory: selects only ids, colours and the one
// extracted Match ID string — never full `raw` (loading all of it for 1.27M
// rows ran out of memory before; see backfill-source-position-id.ts) —
// batched by Match.id range, since seats are resolved per match. Writes only
// rows whose value changes, grouped by target tuple into updateMany calls.
//
// Safety: the real run refuses to write if any cubeConfident = 1 row would
// change, unless --accept-confident-changes=N is given and N is exactly the
// number found (so an approval of "these 27 rows" can't silently cover a
// different set). The 2026-10-06 local dry run found 27, all in match
// 46000168 game 4; the user approved them and the local run applied them on
// 2026-10-07 (--accept-confident-changes=27). Oracle needs its own dry-run
// count, approved by the user. Review the dry run first.
//
// Usage:
//   npx tsx scripts/backfill-decision-cube-from-match-id.ts --dry-run   # count only
//   npx tsx scripts/backfill-decision-cube-from-match-id.ts             # write
//   npx tsx scripts/backfill-decision-cube-from-match-id.ts --accept-confident-changes=27
//
// Idempotent: a second run finds 0 rows to change.
//
// Runs against whatever DATABASE_URL is currently configured in .env.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { PlayerUserIds, addSeatEvidence, decodeGnuMatchId, type DecodedMatchId } from "@/lib/gnuMatchId";

const DRY_RUN = process.argv.includes("--dry-run");
const ACCEPT_ARG = process.argv.find((a) => a.startsWith("--accept-confident-changes="));
const ACCEPTED_CONFIDENT_CHANGES = ACCEPT_ARG ? Number(ACCEPT_ARG.split("=")[1]) : 0;
const MATCH_BATCH = 100;
const UPDATE_CHUNK = 2000;
const EXAMPLE_LIMIT = 10;

interface Row {
  id: number;
  matchId: number;
  userId: string;
  color: string;
  analysedEvent: string;
  mid: string | null;
  cubeValue: number | null;
  cubeOwnerUserId: string | null;
  cubeConfident: number | boolean | null;
}

interface Target {
  cubeValue: number | null;
  cubeOwnerUserId: string | null;
  cubeConfident: boolean;
}

function asBool(v: number | boolean | null): boolean | null {
  return v === null ? null : Boolean(Number(v));
}

async function confidentCounts(): Promise<Record<string, number>> {
  const rows = await prisma.$queryRaw<{ cubeConfident: number | null; n: bigint }[]>`
    SELECT cubeConfident, COUNT(*) AS n FROM Decision GROUP BY cubeConfident
  `;
  return Object.fromEntries(rows.map((r) => [String(r.cubeConfident), Number(r.n)]));
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — counting only, nothing will be written.\n" : "LIVE RUN — will write changes.\n");
  console.log("cubeConfident counts (before):", await confidentCounts());

  const [{ maxMatchId }] = await prisma.$queryRaw<{ maxMatchId: number | null }[]>`
    SELECT MAX(id) AS maxMatchId FROM \`Match\`
  `;

  let total = 0;
  let undecodable = 0;
  let ownerUnmapped = 0;
  const changedByPrevConfident: Record<string, number> = {};
  let conf0ValueChanged = 0;
  let conf0OwnerChanged = 0;
  const confidentExamples: string[] = [];
  const idsByTarget = new Map<string, { target: Target; ids: number[] }>();

  for (let lo = 0; lo < (maxMatchId ?? 0); lo += MATCH_BATCH) {
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT d.id, g.matchId, d.userId, d.color, d.analysedEvent,
             JSON_UNQUOTE(JSON_EXTRACT(d.raw, '$.reviews[0].source_match.formatted_value')) AS mid,
             d.cubeValue, d.cubeOwnerUserId, d.cubeConfident
      FROM Decision d JOIN Game g ON g.id = d.gameId
      WHERE g.matchId > ${lo} AND g.matchId <= ${lo + MATCH_BATCH}
    `;

    const decoded = new Map<number, DecodedMatchId | null>();
    const playersByMatch = new Map<number, PlayerUserIds>();
    for (const r of rows) {
      const m = decodeGnuMatchId(r.mid);
      decoded.set(r.id, m);
      let players = playersByMatch.get(r.matchId);
      if (!players) playersByMatch.set(r.matchId, (players = new PlayerUserIds()));
      addSeatEvidence(players, { userId: r.userId, color: r.color, analysedEvent: r.analysedEvent, matchId: m });
    }

    for (const r of rows) {
      total++;
      const m = decoded.get(r.id) ?? null;
      const ownerId = m && m.cubeOwner !== null ? playersByMatch.get(r.matchId)!.userIdFor(m.cubeOwner) : null;
      const confident = m !== null && (m.cubeOwner === null || ownerId !== null);
      if (!m) undecodable++;
      else if (!confident) ownerUnmapped++;
      const target: Target = {
        cubeValue: confident ? m!.cubeValue : null,
        cubeOwnerUserId: confident ? ownerId : null,
        cubeConfident: confident,
      };

      const prevConfident = asBool(r.cubeConfident);
      const same =
        r.cubeValue === target.cubeValue &&
        r.cubeOwnerUserId === target.cubeOwnerUserId &&
        prevConfident === target.cubeConfident;
      if (same) continue;

      const prevKey = String(prevConfident === null ? "null" : Number(prevConfident));
      changedByPrevConfident[prevKey] = (changedByPrevConfident[prevKey] ?? 0) + 1;
      if (prevConfident === false) {
        if (r.cubeValue !== target.cubeValue) conf0ValueChanged++;
        if (r.cubeOwnerUserId !== target.cubeOwnerUserId) conf0OwnerChanged++;
      }
      if (prevConfident === true && confidentExamples.length < EXAMPLE_LIMIT) {
        confidentExamples.push(
          `  id ${r.id} (${r.analysedEvent}, ${r.mid}): value ${r.cubeValue}->${target.cubeValue}, owner ${r.cubeOwnerUserId}->${target.cubeOwnerUserId}, confident ${prevConfident}->${target.cubeConfident}`
        );
      }

      const key = `${target.cubeValue}|${target.cubeOwnerUserId}|${target.cubeConfident}`;
      let bucket = idsByTarget.get(key);
      if (!bucket) idsByTarget.set(key, (bucket = { target, ids: [] }));
      bucket.ids.push(r.id);
    }
    process.stdout.write(`\rScanned matches up to id ${Math.min(lo + MATCH_BATCH, maxMatchId ?? 0)} / ${maxMatchId} (${total} rows)`);
  }

  const pending = [...idsByTarget.values()].reduce((n, b) => n + b.ids.length, 0);
  console.log("\n\n=== Scan ===");
  console.log(`Decision rows scanned: ${total}`);
  console.log(`Match ID missing/undecodable: ${undecodable}`);
  console.log(`Owner seat with no known userId: ${ownerUnmapped}`);
  console.log(`Rows that would change: ${pending}`);
  console.log(`  ...that are cubeConfident = 1 today (expected 0): ${changedByPrevConfident["1"] ?? 0}`);
  console.log(`  ...that are cubeConfident = 0 today: ${changedByPrevConfident["0"] ?? 0} (value changes: ${conf0ValueChanged}, owner changes: ${conf0OwnerChanged})`);
  console.log(`  ...that are cubeConfident = null today: ${changedByPrevConfident["null"] ?? 0}`);
  if (confidentExamples.length > 0) {
    console.log("Examples of cubeConfident = 1 rows that would change:");
    for (const e of confidentExamples) console.log(e);
  }
  console.log(`Distinct target tuples: ${idsByTarget.size}`);

  if (!DRY_RUN) {
    const confidentChanges = changedByPrevConfident["1"] ?? 0;
    if (confidentChanges !== ACCEPTED_CONFIDENT_CHANGES) {
      console.error(
        `\nRefusing to write: ${confidentChanges} cubeConfident = 1 rows would change, ${ACCEPTED_CONFIDENT_CHANGES} accepted (--accept-confident-changes=N must equal the count exactly). Investigate the examples above first.`
      );
      await prisma.$disconnect();
      process.exit(1);
    }
    let written = 0;
    for (const { target, ids } of idsByTarget.values()) {
      for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
        const chunk = ids.slice(i, i + UPDATE_CHUNK);
        const result = await prisma.decision.updateMany({ where: { id: { in: chunk } }, data: target });
        written += result.count;
      }
      process.stdout.write(`\rRows written: ${written} / ${pending}`);
    }
    console.log(`\nRows written: ${written}`);
  }

  console.log("\n=== Summary ===");
  console.log(DRY_RUN ? "(dry run — nothing was written)" : "(live run — changes above were written)");
  console.log("cubeConfident counts (after):", await confidentCounts());

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
