// Backfill: recomputes Game.userScore/opponentScore/crawfordState and
// Match.matchLength for every already-ingested match from the GNU Match ID
// (raw.reviews[0].source_match.formatted_value), the same rule lib/ingest.ts
// uses since 2026-10-06. Replaces the deleted
// scripts/backfill-game-score-crawford.ts, which read metadata.scores as
// "black = the actor" — wrong: metadata.scores.white is the score of the
// player on roll — and so swapped the two scores on about half of all
// games, and which left Galaxy's older analyses (metadata.scores null)
// without scores or a match length. See docs/field-mapping.md, "GNU Match ID".
//
// Rule (lib/gnuMatchId.ts, one source of truth with ingest):
//   Game: from the Match ID of the game's first decision by eventId —
//         gameScoreFromMatchId(): scores through the user's own seat
//         (PlayerIdentity.isMe; black = player 1, white = player 0),
//         crawfordState from the Crawford bit + scores/length; all three
//         null for a money game (length 0). Scores are left untouched when
//         the user's seat can't be resolved (counted below).
//   Match.matchLength: the Match ID length of the match's first decision
//         (lowest gameIndex, then lowest eventId); 0 = money game. This also
//         sets the ~30 single-game matches whose Match ID flips from 0 to 1
//         after a double to 0 (the user's call).
//
// No live Galaxy calls. Selects only ids, colours and the one extracted
// Match ID string (never full `raw`), batched by Match.id range. Writes only
// rows whose value changes.
//
// Usage:
//   npx tsx scripts/backfill-game-scores-from-match-id.ts --dry-run   # count only
//   npx tsx scripts/backfill-game-scores-from-match-id.ts             # write
//
// Idempotent: a second run finds 0 games and 0 matches to change.
//
// Runs against whatever DATABASE_URL is currently configured in .env.
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  PlayerUserIds,
  addSeatEvidence,
  decodeGnuMatchId,
  gameScoreFromMatchId,
  type DecodedMatchId,
} from "@/lib/gnuMatchId";

const DRY_RUN = process.argv.includes("--dry-run");
const MATCH_BATCH = 100;
const EXAMPLE_LIMIT = 5;

interface Row {
  gameId: number;
  matchId: number;
  gameIndex: number;
  eventId: bigint;
  userId: string;
  color: string;
  analysedEvent: string;
  mid: string | null;
}

async function main() {
  console.log(DRY_RUN ? "DRY RUN — counting only, nothing will be written.\n" : "LIVE RUN — will write changes.\n");

  const me = await prisma.playerIdentity.findFirst({ where: { source: "galaxy", isMe: true } });
  if (!me) console.warn("No isMe PlayerIdentity — scores can't be mapped and will be left as-is.");

  const [{ maxMatchId }] = await prisma.$queryRaw<{ maxMatchId: number | null }[]>`
    SELECT MAX(id) AS maxMatchId FROM \`Match\`
  `;

  const [{ nullScoreGames, nullLengthMatches }] = await prisma.$queryRaw<
    { nullScoreGames: bigint; nullLengthMatches: bigint }[]
  >`
    SELECT (SELECT COUNT(*) FROM Game WHERE userScore IS NULL) AS nullScoreGames,
           (SELECT COUNT(*) FROM \`Match\` WHERE matchLength IS NULL) AS nullLengthMatches
  `;
  console.log(`Before: games with null userScore: ${nullScoreGames}; matches with null matchLength: ${nullLengthMatches}\n`);

  let gamesScanned = 0;
  let gamesUndecodable = 0;
  let gamesSeatUnknown = 0;
  let gamesScoreChanged = 0; // value -> different value
  let gamesScoreNullToValue = 0;
  let gamesScoreValueToNull = 0;
  let gamesCrawfordChanged = 0;
  let gamesToWrite = 0;
  let matchesScanned = 0;
  let matchesLengthChanged = 0; // value -> different value
  let matchesLengthNullToValue = 0;
  let matchesFlipSetToZero = 0; // first decision length 0, a later one non-zero
  let matchesToWrite = 0;
  const scoreExamples: string[] = [];
  const gameWrites: { id: number; data: Record<string, unknown> }[] = [];
  const matchWrites: { id: number; matchLength: number }[] = [];

  for (let lo = 0; lo < (maxMatchId ?? 0); lo += MATCH_BATCH) {
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT d.gameId, g.matchId, g.gameIndex, d.eventId, d.userId, d.color, d.analysedEvent,
             JSON_UNQUOTE(JSON_EXTRACT(d.raw, '$.reviews[0].source_match.formatted_value')) AS mid
      FROM Decision d JOIN Game g ON g.id = d.gameId
      WHERE g.matchId > ${lo} AND g.matchId <= ${lo + MATCH_BATCH}
    `;
    const games = await prisma.game.findMany({
      where: { matchId: { gt: lo, lte: lo + MATCH_BATCH } },
      select: { id: true, matchId: true, gameIndex: true, userScore: true, opponentScore: true, crawfordState: true },
    });
    const matches = await prisma.match.findMany({
      where: { id: { gt: lo, lte: lo + MATCH_BATCH } },
      select: { id: true, sourceMatchId: true, matchLength: true },
    });

    const playersByMatch = new Map<number, PlayerUserIds>();
    const firstByGame = new Map<number, { eventId: bigint; m: DecodedMatchId | null }>();
    const firstByMatch = new Map<number, { gameIndex: number; eventId: bigint; m: DecodedMatchId | null }>();
    const lengthsByMatch = new Map<number, Set<number>>();
    for (const r of rows) {
      const m = decodeGnuMatchId(r.mid);
      let players = playersByMatch.get(r.matchId);
      if (!players) playersByMatch.set(r.matchId, (players = new PlayerUserIds()));
      addSeatEvidence(players, { userId: r.userId, color: r.color, analysedEvent: r.analysedEvent, matchId: m });

      const g = firstByGame.get(r.gameId);
      if (!g || r.eventId < g.eventId) firstByGame.set(r.gameId, { eventId: r.eventId, m });
      const f = firstByMatch.get(r.matchId);
      if (!f || r.gameIndex < f.gameIndex || (r.gameIndex === f.gameIndex && r.eventId < f.eventId)) {
        firstByMatch.set(r.matchId, { gameIndex: r.gameIndex, eventId: r.eventId, m });
      }
      if (m) {
        let lengths = lengthsByMatch.get(r.matchId);
        if (!lengths) lengthsByMatch.set(r.matchId, (lengths = new Set()));
        lengths.add(m.matchLength);
      }
    }

    for (const game of games) {
      const first = firstByGame.get(game.id);
      if (!first) continue; // no decisions stored for this game
      gamesScanned++;
      if (!first.m) {
        gamesUndecodable++;
        continue;
      }
      const target = gameScoreFromMatchId(first.m, playersByMatch.get(game.matchId)!, me?.sourceUserId);
      const data: Record<string, unknown> = {};
      if (target.crawfordState !== game.crawfordState) {
        data.crawfordState = target.crawfordState;
        gamesCrawfordChanged++;
      }
      if (!("userScore" in target)) {
        gamesSeatUnknown++;
      } else if (target.userScore !== game.userScore || target.opponentScore !== game.opponentScore) {
        data.userScore = target.userScore;
        data.opponentScore = target.opponentScore;
        if (game.userScore === null) gamesScoreNullToValue++;
        else if (target.userScore === null) gamesScoreValueToNull++;
        else gamesScoreChanged++;
        if (game.userScore !== null && target.userScore !== null && scoreExamples.length < EXAMPLE_LIMIT) {
          scoreExamples.push(
            `  match id ${game.matchId} game ${game.gameIndex}: user ${game.userScore}->${target.userScore}, opp ${game.opponentScore}->${target.opponentScore}`
          );
        }
      }
      if (Object.keys(data).length > 0) {
        gamesToWrite++;
        gameWrites.push({ id: game.id, data });
      }
    }

    for (const match of matches) {
      const first = firstByMatch.get(match.id);
      if (!first?.m) continue;
      matchesScanned++;
      const length = first.m.matchLength;
      const lengths = lengthsByMatch.get(match.id) ?? new Set<number>();
      const flips = length === 0 && [...lengths].some((l) => l !== 0);
      if (flips) matchesFlipSetToZero++;
      if (match.matchLength === length) continue;
      if (match.matchLength === null) matchesLengthNullToValue++;
      else matchesLengthChanged++;
      matchesToWrite++;
      matchWrites.push({ id: match.id, matchLength: length });
    }
    process.stdout.write(`\rScanned matches up to id ${Math.min(lo + MATCH_BATCH, maxMatchId ?? 0)} / ${maxMatchId}`);
  }

  console.log("\n\n=== Scan ===");
  console.log(`Games scanned (with decisions): ${gamesScanned}`);
  console.log(`  first decision's Match ID undecodable: ${gamesUndecodable}`);
  console.log(`  user's seat unknown (scores left as-is): ${gamesSeatUnknown}`);
  console.log(`  scores change value -> different value: ${gamesScoreChanged}`);
  console.log(`  scores null -> value: ${gamesScoreNullToValue}`);
  console.log(`  scores value -> null (money game): ${gamesScoreValueToNull}`);
  console.log(`  crawfordState changes: ${gamesCrawfordChanged}`);
  console.log(`  games to write: ${gamesToWrite}`);
  if (scoreExamples.length > 0) {
    console.log("Examples of changed scores:");
    for (const e of scoreExamples) console.log(e);
  }
  console.log(`Matches scanned (first decision decodes): ${matchesScanned}`);
  console.log(`  matchLength null -> value: ${matchesLengthNullToValue}`);
  console.log(`  matchLength value -> different value: ${matchesLengthChanged}`);
  console.log(`  matches whose first decision is money (0) but a later one isn't (stored as 0): ${matchesFlipSetToZero}`);
  console.log(`  matches to write: ${matchesToWrite}`);

  if (!DRY_RUN) {
    let written = 0;
    for (const w of gameWrites) {
      await prisma.game.update({ where: { id: w.id }, data: w.data });
      written++;
      if (written % 500 === 0) process.stdout.write(`\rGames written: ${written} / ${gameWrites.length}`);
    }
    console.log(`\rGames written: ${written}`);
    for (const w of matchWrites) {
      await prisma.match.update({ where: { id: w.id }, data: { matchLength: w.matchLength } });
    }
    console.log(`Matches written: ${matchWrites.length}`);
  }

  const [after] = await prisma.$queryRaw<{ nullScoreGames: bigint; nullLengthMatches: bigint }[]>`
    SELECT (SELECT COUNT(*) FROM Game WHERE userScore IS NULL) AS nullScoreGames,
           (SELECT COUNT(*) FROM \`Match\` WHERE matchLength IS NULL) AS nullLengthMatches
  `;
  console.log("\n=== Summary ===");
  console.log(DRY_RUN ? "(dry run — nothing was written)" : "(live run — changes above were written)");
  console.log(`After: games with null userScore: ${after.nullScoreGames}; matches with null matchLength: ${after.nullLengthMatches}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
