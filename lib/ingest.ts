// Single-match ingest: pulls a match's games from Galaxy (via galaxy-client,
// same fetch behavior as everywhere else) and writes Match/Game/Decision
// rows. Triggered manually, per match, from the "Sync" button on
// /galaxy/matches — no scheduler, no multi-match loop yet (that's a later
// upgrade; this function is already shaped so looping it over several
// matchIds is just a caller-side change).
import { prisma } from "@/lib/prisma";
import { createGalaxyClient } from "@/lib/galaxy-client";
import { DecisionKind, ErrorSeverity } from "@/lib/generated/prisma/client";
import type { Review } from "@/lib/gameReviewsTypes";

const MAX_GAMES = 20;

// game_started/game_over/turn_forfeited events are never decisions and are
// never stored as Decision rows — excluded explicitly, even though they
// wouldn't normally carry a reviews[0] anyway.
const NON_DECISION_EVENT_TYPES = new Set(["game_started", "game_over", "turn_forfeited"]);

export interface MatchIndexData {
  opponentName: string;
  opponentCountry: string;
  opponentRating: number;
  opponentError: number;
  opponentScore: number;
  userError: number;
  userRating: number;
  userScore: number;
}

export interface IngestSummary {
  matchId: number;
  gamesIngested: number;
  decisionsIngested: number;
  errors: string[];
}

function mapSeverity(severity: string): ErrorSeverity {
  switch (severity) {
    case "blunder":
      return ErrorSeverity.BLUNDER;
    case "error":
      return ErrorSeverity.ERROR;
    case "doubtful":
      return ErrorSeverity.DOUBTFUL;
    default:
      return ErrorSeverity.NONE;
  }
}

function moveNotations(review: Review): { played: string | null; best: string | null } {
  if (review.result.analysed_event !== "move") return { played: null, best: null };
  const moves = review.result.result.moves;
  const played = moves.find((m) => m.move_played);
  const best = moves.find((m) => m.rank === 1) ?? moves[0];
  return { played: played?.notation ?? null, best: best?.notation ?? null };
}

function buildCubeDetail(review: Review): string | null {
  if (review.result.analysed_event === "move") return null;
  const cube = review.result.result.cube_analysis;

  if (review.result.analysed_event === "cube_double") {
    const mine = review.double ? "doubled" : "did not double";
    return `${mine} — best: ${cube.doublers_best_action.replace(/_/g, " ")}`;
  }

  const mine = review.take ? "took" : "passed";
  return `${mine} — best: ${cube.receivers_best_action.replace(/_/g, " ")}`;
}

export async function ingestMatch(
  matchId: number,
  indexData: MatchIndexData,
  token: string
): Promise<IngestSummary> {
  const errors: string[] = [];
  let gamesIngested = 0;
  let decisionsIngested = 0;
  let matchLength: number | null = null;
  const gamePlayedAts: Date[] = [];

  await prisma.match.upsert({
    where: { id: matchId },
    create: { id: matchId, ...indexData },
    update: { ...indexData },
  });

  const client = createGalaxyClient(token);

  for (let gameIndex = 1; gameIndex <= MAX_GAMES; gameIndex++) {
    let response;
    try {
      response = await client.getGameReviews(matchId, gameIndex);
    } catch (e) {
      errors.push(`game ${gameIndex}: ${e instanceof Error ? e.message : "fetch failed"}`);
      break;
    }

    // null = not found / end of match (the same 404/empty-events condition
    // galaxy-client already normalizes) — natural end of the loop.
    if (!response) break;

    const game = await prisma.game.upsert({
      where: { matchId_gameIndex: { matchId, gameIndex } },
      create: { matchId, gameIndex },
      update: {},
    });

    // Cube ownership isn't in the payload directly — walk this game's
    // cube-kind decisions in order, tracking who last took a double.
    let cubeOwner: string | null = null;
    const decisionTimestamps: Date[] = [];

    for (const event of response.data.events) {
      if (NON_DECISION_EVENT_TYPES.has(event.event_type)) continue;

      const review = event.reviews?.[0];
      if (!review) continue;

      try {
        const analysedEvent = review.result.analysed_event;
        const kind = analysedEvent === "move" ? DecisionKind.CHECKER : DecisionKind.CUBE;
        const metadata = review.result.result.metadata;
        const errorAnalysis = review.result.result.error_analysis;
        const probabilities = review.result.result.probabilities;

        const classification = review.source_position?.classification;
        if (!classification) {
          errors.push(
            `game ${gameIndex} event ${event.id}: missing source_position.classification, skipped`
          );
          continue;
        }

        // Owner entering this decision, before applying its own outcome.
        const cubeOwnerUserId = kind === DecisionKind.CUBE ? cubeOwner : null;
        if (kind === DecisionKind.CUBE && analysedEvent === "cube_pass" && review.take === true) {
          cubeOwner = event.user_id;
        }

        const { played, best } = moveNotations(review);
        const timestamp = new Date(metadata.timestamp);
        decisionTimestamps.push(timestamp);
        matchLength = metadata.match_length;

        const decisionData = {
          userId: event.user_id,
          color: event.color,
          kind,
          analysedEvent,
          countAsDecision: metadata.count_as_decision,
          rawError: errorAnalysis.raw_error,
          errorSeverity: mapSeverity(errorAnalysis.error_severity),
          isBlunder: errorAnalysis.is_blunder,
          luck: errorAnalysis.luck,
          luckMwc: errorAnalysis.luck_mwc,
          equity: review.result.result.equity,
          mwc: probabilities.mwc_context !== null ? probabilities.mwc : null,
          classification,
          matchScoreBlack: metadata.scores.black,
          matchScoreWhite: metadata.scores.white,
          crawfordState: metadata.crawford_state,
          cubeOwnerUserId,
          notationPlayed: played,
          notationBest: best,
          cubeDetail: buildCubeDetail(review),
          timestamp,
          myTag: null,
          // Round-trip through JSON so the value is a plain JSON-compatible
          // object, matching what Prisma's Json column input expects.
          raw: JSON.parse(JSON.stringify(event)),
        };

        await prisma.decision.upsert({
          where: { gameId_eventId: { gameId: game.id, eventId: BigInt(event.id) } },
          create: { gameId: game.id, eventId: BigInt(event.id), ...decisionData },
          update: decisionData,
        });

        decisionsIngested++;
      } catch (e) {
        errors.push(
          `game ${gameIndex} event ${event.id}: ${e instanceof Error ? e.message : "failed to ingest"}`
        );
      }
    }

    if (decisionTimestamps.length > 0) {
      const earliest = new Date(Math.min(...decisionTimestamps.map((d) => d.getTime())));
      await prisma.game.update({ where: { id: game.id }, data: { playedAt: earliest } });
      gamePlayedAts.push(earliest);
    }

    gamesIngested++;
  }

  const matchUpdate: { matchLength?: number; playedAt?: Date } = {};
  if (matchLength !== null) matchUpdate.matchLength = matchLength;
  if (gamePlayedAts.length > 0) {
    matchUpdate.playedAt = new Date(Math.min(...gamePlayedAts.map((d) => d.getTime())));
  }
  if (Object.keys(matchUpdate).length > 0) {
    await prisma.match.update({ where: { id: matchId }, data: matchUpdate });
  }

  return { matchId, gamesIngested, decisionsIngested, errors };
}
