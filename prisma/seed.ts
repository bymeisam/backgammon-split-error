// Fake data for local development only. Not real Galaxy ingest — safe to
// truncate once the real index-sync/detail-ingest jobs exist. Never wired
// into `prisma migrate dev`; run standalone via `npx prisma db seed`.
//
// `raw` on each Decision is a fully-shaped GameEvent (matching
// lib/gameReviewsTypes.ts) rather than a bare placeholder marker — the
// DB-backed read path (lib/local-client.ts) reconstructs a game's events
// array straight from these `raw` values, so they need to actually parse
// the same way real Galaxy events do for the mistakes/board UI to render
// anything. The position id is a real, decodable GNU starting position
// (verified against lib/gnuPositionId.ts) reused for every decision — it
// doesn't need to reflect the literal move, only to decode without error.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  DecisionKind,
  ErrorSeverity,
  type Prisma,
} from "../lib/generated/prisma/client";
import type {
  GameEvent,
  Probabilities,
  Review,
  AnalysisEnvelope,
} from "../lib/gameReviewsTypes";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const YOU_USER_ID = "seed-user-you";

// Verified starting position — decodes cleanly via decodeGnuPositionId.
// Reused for every seeded decision; only needs to be valid, not literally
// accurate for the notation played.
const SEED_POSITION_ID = "4HPwATDgc/ABMA";

const PLACEHOLDER_PROBABILITIES: Probabilities = {
  lose: 0.5,
  lose_backgammon: 0.01,
  lose_gammon: 0.1,
  win: 0.5,
  win_backgammon: 0.01,
  win_gammon: 0.1,
  mwc_context: "cubeless",
  mwc: 0.5,
  volatility: 0.05,
  market_losing_probability: 0.1,
  market_gaining_probability: 0.1,
};

interface DecisionRecipe {
  kind: DecisionKind;
  severity: ErrorSeverity;
  classification: string;
  notationPlayed: string | null;
  notationBest: string | null;
  cubeDoubled: boolean | null; // only meaningful for CUBE recipes
  doublersBestAction: string | null;
  crawfordState: string;
  rawError: number;
}

// Ten decision "recipes" reused (with per-game offsets applied) for every
// seeded game — gives a deliberate mix of kind/severity/classification
// without hand-writing ~30 near-identical rows.
const DECISION_RECIPES: DecisionRecipe[] = [
  {
    kind: DecisionKind.CHECKER,
    severity: ErrorSeverity.NONE,
    classification: "opening",
    notationPlayed: "24/23 13/9",
    notationBest: "24/23 13/9",
    cubeDoubled: null,
    doublersBestAction: null,
    crawfordState: "none",
    rawError: 0,
  },
  {
    kind: DecisionKind.CHECKER,
    severity: ErrorSeverity.NONE,
    classification: "priming_game",
    notationPlayed: "13/9 13/9",
    notationBest: "13/9 13/9",
    cubeDoubled: null,
    doublersBestAction: null,
    crawfordState: "none",
    rawError: 0,
  },
  {
    kind: DecisionKind.CUBE,
    severity: ErrorSeverity.NONE,
    classification: "middle_game",
    notationPlayed: null,
    notationBest: null,
    cubeDoubled: false,
    doublersBestAction: "no_double",
    crawfordState: "none",
    rawError: 0,
  },
  {
    kind: DecisionKind.CHECKER,
    severity: ErrorSeverity.DOUBTFUL,
    classification: "blitz",
    notationPlayed: "6/2 6/1",
    notationBest: "6/1 4/1",
    cubeDoubled: null,
    doublersBestAction: null,
    crawfordState: "none",
    rawError: 0.025,
  },
  {
    kind: DecisionKind.CHECKER,
    severity: ErrorSeverity.ERROR,
    classification: "holding_game",
    notationPlayed: "13/7",
    notationBest: "13/8 6/5",
    cubeDoubled: null,
    doublersBestAction: null,
    crawfordState: "none",
    rawError: 0.055,
  },
  {
    kind: DecisionKind.CUBE,
    severity: ErrorSeverity.DOUBTFUL,
    classification: "race",
    notationPlayed: null,
    notationBest: null,
    cubeDoubled: true,
    doublersBestAction: "no_double",
    crawfordState: "none",
    rawError: 0.03,
  },
  {
    kind: DecisionKind.CHECKER,
    severity: ErrorSeverity.BLUNDER,
    classification: "back_game",
    notationPlayed: "8/2 6/2",
    notationBest: "13/7 6/2",
    cubeDoubled: null,
    doublersBestAction: null,
    crawfordState: "none",
    rawError: 0.14,
  },
  {
    kind: DecisionKind.CUBE,
    severity: ErrorSeverity.ERROR,
    classification: "middle_game",
    notationPlayed: null,
    notationBest: null,
    cubeDoubled: false,
    doublersBestAction: "double",
    crawfordState: "crawford",
    rawError: 0.06,
  },
  {
    kind: DecisionKind.CHECKER,
    severity: ErrorSeverity.NONE,
    classification: "race",
    notationPlayed: "6/1 6/2",
    notationBest: "6/1 6/2",
    cubeDoubled: null,
    doublersBestAction: null,
    crawfordState: "none",
    rawError: 0,
  },
  {
    kind: DecisionKind.CUBE,
    severity: ErrorSeverity.NONE,
    classification: "blitz",
    notationPlayed: null,
    notationBest: null,
    cubeDoubled: false,
    doublersBestAction: "no_double",
    crawfordState: "post_crawford",
    rawError: 0,
  },
];

function lerpScore(start: number, end: number, i: number, total: number): number {
  return Math.round(start + ((end - start) * i) / (total - 1));
}

function cubeDetailFor(recipe: DecisionRecipe): string {
  const mine = recipe.cubeDoubled ? "doubled" : "did not double";
  const best = recipe.doublersBestAction?.replace(/_/g, " ") ?? "";
  return `${mine} — best: ${best}`;
}

function buildRawEvent(params: {
  eventId: bigint;
  recipe: DecisionRecipe;
  matchScoreBlack: number;
  matchScoreWhite: number;
  timestamp: Date;
  indexInGame: number;
}): GameEvent {
  const { eventId, recipe, matchScoreBlack, matchScoreWhite, timestamp, indexInGame } = params;

  const metadata = {
    timestamp: timestamp.toISOString(),
    analysis_level: 3,
    analysis_time_ms: 50,
    crawford_state: recipe.crawfordState,
    match_length: 5,
    scores: { black: matchScoreBlack, white: matchScoreWhite },
    count_as_decision: true,
    request_id: null,
    max_move: null,
  };

  const errorAnalysis = {
    raw_error: recipe.rawError,
    luck_mwc: null,
    mwc_error: null,
    luck: null,
    equity_error: null,
    error_severity: recipe.severity.toLowerCase() as Review["result"]["result"]["error_analysis"]["error_severity"],
    is_blunder: recipe.severity === ErrorSeverity.BLUNDER,
    is_error: recipe.severity === ErrorSeverity.ERROR || recipe.severity === ErrorSeverity.BLUNDER,
  };

  const sourcePosition = {
    id: indexInGame + 1,
    classification: recipe.classification,
    formatted_value: SEED_POSITION_ID,
  };

  let result: AnalysisEnvelope;

  if (recipe.kind === DecisionKind.CHECKER) {
    const isMistake = recipe.notationPlayed !== recipe.notationBest;
    const moves = isMistake
      ? [
          {
            level: 3,
            final: { xgid: "", gnubgid: "" },
            notation: recipe.notationPlayed!,
            rank: 2,
            equity: -recipe.rawError,
            probabilities: PLACEHOLDER_PROBABILITIES,
            error_analysis: errorAnalysis,
            move_played: true,
          },
          {
            level: 3,
            final: { xgid: "", gnubgid: "" },
            notation: recipe.notationBest!,
            rank: 1,
            equity: 0,
            probabilities: PLACEHOLDER_PROBABILITIES,
            error_analysis: { ...errorAnalysis, raw_error: 0, is_blunder: false, is_error: false },
            move_played: false,
          },
        ]
      : [
          {
            level: 3,
            final: { xgid: "", gnubgid: "" },
            notation: recipe.notationPlayed!,
            rank: 1,
            equity: 0,
            probabilities: PLACEHOLDER_PROBABILITIES,
            error_analysis: errorAnalysis,
            move_played: true,
          },
        ];

    result = {
      version: "1",
      analysed_event: "move",
      result: {
        metadata,
        equity: 0,
        probabilities: PLACEHOLDER_PROBABILITIES,
        error_analysis: errorAnalysis,
        moves,
      },
    };
  } else {
    const cubeAnalysis = {
      optimal: 0,
      cubeless: 0,
      doublers_best_action: recipe.doublersBestAction ?? "no_double",
      receivers_best_action: "take",
      cube_decision_meaningful: true,
      cube_level: 1,
      diff_double_pass: 0,
      diff_double_take: 0,
      diff_no_double: 0,
      double_pass: 0,
      double_take: 0,
      no_double: 0,
      receiver_diff_double_pass: 0,
      receiver_diff_double_take: 0,
      too_good_meaningful: false,
    };

    result = {
      version: "1",
      analysed_event: "cube_double",
      result: {
        metadata,
        equity: 0,
        probabilities: PLACEHOLDER_PROBABILITIES,
        error_analysis: errorAnalysis,
        cube_analysis: cubeAnalysis,
      },
    };
  }

  const review: Review = {
    id: Number(eventId),
    second: indexInGame * 5,
    take: null,
    level: 3,
    result,
    double: recipe.kind === DecisionKind.CUBE ? recipe.cubeDoubled : null,
    threshold: null,
    destination_position: null,
    source_position: sourcePosition,
    source_match: null,
    resigned_points: null,
  };

  return {
    id: Number(eventId),
    color: "black",
    user_id: YOU_USER_ID,
    moves: [],
    event_type: recipe.kind === DecisionKind.CHECKER ? "move_commited" : "double_requested",
    reviews: [review],
    rolled_dice: [],
  };
}

async function main() {
  // FK-safe order: children before parents. PlayerIdentity is standalone,
  // order relative to the others doesn't matter.
  await prisma.decision.deleteMany();
  await prisma.game.deleteMany();
  await prisma.match.deleteMany();
  await prisma.playerIdentity.deleteMany();

  await prisma.playerIdentity.create({
    data: {
      source: "galaxy",
      sourceUserId: YOU_USER_ID,
      displayName: "Seed Test User",
      isMe: true,
    },
  });

  // Match.id is now an internal auto-increment key — source/sourceMatchId
  // is what a real Galaxy match ID maps to, so seed data uses the same
  // shape ingestMatch would (matching "1"/"2" here is just for readability,
  // not a real Galaxy match ID).
  const match1 = await prisma.match.create({
    data: {
      source: "galaxy",
      sourceMatchId: "1",
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
      source: "galaxy",
      sourceMatchId: "2",
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
        matchId: match1.id,
        gameIndex,
        playedAt: gamePlayedAt,
      },
    });

    const [scoreStartUser, scoreStartOpp, scoreEndUser, scoreEndOpp] =
      gameScoreWindows[gameIndex - 1];

    const decisions: Prisma.DecisionCreateManyInput[] = DECISION_RECIPES.map(
      (recipe, i) => {
        const timestamp = new Date(gamePlayedAt.getTime() + i * 30_000);
        const matchScoreBlack = lerpScore(scoreStartUser, scoreEndUser, i, DECISION_RECIPES.length);
        const matchScoreWhite = lerpScore(scoreStartOpp, scoreEndOpp, i, DECISION_RECIPES.length);
        const thisEventId = eventId++;

        const raw = buildRawEvent({
          eventId: thisEventId,
          recipe,
          matchScoreBlack,
          matchScoreWhite,
          timestamp,
          indexInGame: i,
        });

        const data: Prisma.DecisionCreateManyInput = {
          gameId: game.id,
          eventId: thisEventId,
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
          matchScoreBlack,
          matchScoreWhite,
          crawfordState: recipe.crawfordState,
          cubeOwnerUserId: recipe.kind === DecisionKind.CUBE ? YOU_USER_ID : null,
          notationPlayed: recipe.notationPlayed,
          notationBest: recipe.notationBest,
          cubeDetail: recipe.kind === DecisionKind.CUBE ? cubeDetailFor(recipe) : null,
          timestamp,
          myTag: null,
          raw,
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
