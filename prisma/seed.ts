// Fake data for local development only. Not real Galaxy ingest — safe to
// truncate once the real index-sync/detail-ingest jobs exist. Never wired
// into `prisma migrate dev`; run standalone via `npx prisma db seed`.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  DecisionKind,
  ErrorSeverity,
  type Prisma,
} from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const YOU_USER_ID = "seed-user-you";

// Ten decision "recipes" reused (with per-game offsets applied) for every
// seeded game — gives a deliberate mix of kind/severity/classification
// without hand-writing ~30 near-identical rows.
const DECISION_RECIPES: Array<{
  kind: DecisionKind;
  severity: ErrorSeverity;
  classification: string;
  notationPlayed: string | null;
  notationBest: string | null;
  cubeDetail: string | null;
  crawfordState: string;
  rawError: number;
}> = [
  {
    kind: DecisionKind.CHECKER,
    severity: ErrorSeverity.NONE,
    classification: "opening",
    notationPlayed: "24/23 13/9",
    notationBest: "24/23 13/9",
    cubeDetail: null,
    crawfordState: "none",
    rawError: 0,
  },
  {
    kind: DecisionKind.CHECKER,
    severity: ErrorSeverity.NONE,
    classification: "priming_game",
    notationPlayed: "13/9 13/9",
    notationBest: "13/9 13/9",
    cubeDetail: null,
    crawfordState: "none",
    rawError: 0,
  },
  {
    kind: DecisionKind.CUBE,
    severity: ErrorSeverity.NONE,
    classification: "middle_game",
    notationPlayed: null,
    notationBest: null,
    cubeDetail: "no double — correct, market still open",
    crawfordState: "none",
    rawError: 0,
  },
  {
    kind: DecisionKind.CHECKER,
    severity: ErrorSeverity.DOUBTFUL,
    classification: "blitz",
    notationPlayed: "6/2 6/1",
    notationBest: "6/1 4/1",
    cubeDetail: null,
    crawfordState: "none",
    rawError: 0.025,
  },
  {
    kind: DecisionKind.CHECKER,
    severity: ErrorSeverity.ERROR,
    classification: "holding_game",
    notationPlayed: "13/7",
    notationBest: "13/8 6/5",
    cubeDetail: null,
    crawfordState: "none",
    rawError: 0.055,
  },
  {
    kind: DecisionKind.CUBE,
    severity: ErrorSeverity.DOUBTFUL,
    classification: "race",
    notationPlayed: null,
    notationBest: null,
    cubeDetail: "doubled — close, no double is also fine",
    crawfordState: "none",
    rawError: 0.03,
  },
  {
    kind: DecisionKind.CHECKER,
    severity: ErrorSeverity.BLUNDER,
    classification: "back_game",
    notationPlayed: "8/2 6/2",
    notationBest: "13/7 6/2",
    cubeDetail: null,
    crawfordState: "none",
    rawError: 0.14,
  },
  {
    kind: DecisionKind.CUBE,
    severity: ErrorSeverity.ERROR,
    classification: "middle_game",
    notationPlayed: null,
    notationBest: null,
    cubeDetail: "did not double — best: double/take",
    crawfordState: "crawford",
    rawError: 0.06,
  },
  {
    kind: DecisionKind.CHECKER,
    severity: ErrorSeverity.NONE,
    classification: "race",
    notationPlayed: "6/1 6/2",
    notationBest: "6/1 6/2",
    cubeDetail: null,
    crawfordState: "none",
    rawError: 0,
  },
  {
    kind: DecisionKind.CUBE,
    severity: ErrorSeverity.NONE,
    classification: "blitz",
    notationPlayed: null,
    notationBest: null,
    cubeDetail: "no double — correct, too good to double",
    crawfordState: "post_crawford",
    rawError: 0,
  },
];

function lerpScore(start: number, end: number, i: number, total: number): number {
  return Math.round(start + ((end - start) * i) / (total - 1));
}

async function main() {
  // FK-safe order: children before parents.
  await prisma.decision.deleteMany();
  await prisma.game.deleteMany();
  await prisma.match.deleteMany();

  await prisma.match.create({
    data: {
      id: 1,
      matchLength: 5,
      opponentName: "TEST Opponent Alpha",
      opponentCountry: "XX",
      opponentRating: 1523.4,
      opponentError: 6.8,
      opponentScore: 3,
      userError: 4.2,
      userRating: 1611.7,
      userScore: 5,
      playedAt: new Date("2026-09-10T14:00:00Z"),
    },
  });

  await prisma.match.create({
    data: {
      id: 2,
      matchLength: 5,
      opponentName: "TEST Opponent Beta",
      opponentCountry: "ZZ",
      opponentRating: 1488.0,
      opponentError: 5.1,
      opponentScore: 5,
      userError: 7.9,
      userRating: 1590.2,
      userScore: 3,
      playedAt: null,
      // No games/decisions for this match — simulates "index-synced only".
    },
  });

  // Only match 1 has games/decisions (it's the one with playedAt set, i.e.
  // "fully detail-ingested"). Each game's decisions carry the running match
  // score, interpolated from the score entering the game to the score after
  // it (game 1: 0-0 -> 2-0, game 2: 2-0 -> 2-3, game 3: 2-3 -> 5-3).
  const gameScoreWindows: Array<[number, number, number, number]> = [
    [0, 0, 2, 0],
    [2, 0, 2, 3],
    [2, 3, 5, 3],
  ];

  let eventId = 9_000_000_001n;
  const matchPlayedAt = new Date("2026-09-10T14:00:00Z");

  for (let gameIndex = 1; gameIndex <= 3; gameIndex++) {
    const gamePlayedAt = new Date(matchPlayedAt.getTime() + gameIndex * 20 * 60_000);

    const game = await prisma.game.create({
      data: {
        matchId: 1,
        gameIndex,
        playedAt: gamePlayedAt,
      },
    });

    const [scoreStartUser, scoreStartOpp, scoreEndUser, scoreEndOpp] =
      gameScoreWindows[gameIndex - 1];

    const decisions: Prisma.DecisionCreateManyInput[] = DECISION_RECIPES.map(
      (recipe, i) => {
        const timestamp = new Date(gamePlayedAt.getTime() + i * 30_000);
        const data: Prisma.DecisionCreateManyInput = {
          gameId: game.id,
          eventId: eventId++,
          userId: YOU_USER_ID,
          color: "black",
          kind: recipe.kind,
          analysedEvent: recipe.kind === DecisionKind.CUBE ? "cube_double" : "move",
          countAsDecision: true,
          rawError: recipe.rawError,
          errorSeverity: recipe.severity,
          isBlunder: recipe.severity === ErrorSeverity.BLUNDER,
          luck: null,
          luckMwc: null,
          equity: recipe.rawError === 0 ? 0.5 : 0.5 - recipe.rawError,
          mwc: 0.5,
          classification: recipe.classification,
          // "black" is the user's side in this seeded match.
          matchScoreBlack: lerpScore(scoreStartUser, scoreEndUser, i, DECISION_RECIPES.length),
          matchScoreWhite: lerpScore(scoreStartOpp, scoreEndOpp, i, DECISION_RECIPES.length),
          crawfordState: recipe.crawfordState,
          cubeOwnerUserId: recipe.kind === DecisionKind.CUBE ? YOU_USER_ID : null,
          notationPlayed: recipe.notationPlayed,
          notationBest: recipe.notationBest,
          cubeDetail: recipe.cubeDetail,
          timestamp,
          myTag: null,
          raw: { seed: true, note: "placeholder event payload, not real Galaxy data" },
        };
        return data;
      }
    );

    await prisma.decision.createMany({ data: decisions });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
