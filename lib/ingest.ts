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

// This file is Galaxy-specific ingest logic, so the source tag is hardcoded
// here rather than threaded through as a parameter — a future second source
// would get its own ingest module with its own SOURCE constant, not a branch
// in this one.
const SOURCE = "galaxy";

// game_started/game_over/turn_forfeited events are never decisions and are
// never stored as Decision rows — excluded explicitly, even though they
// wouldn't normally carry a reviews[0] anyway.
const NON_DECISION_EVENT_TYPES = new Set(["game_started", "game_over", "turn_forfeited"]);

// Some events carry a review with error_analysis: null — an outcome-logging
// event with nothing to grade, not a real decision. Structurally skipped via
// the error_analysis === null check below rather than keyed off event_type,
// so it also covers any future event type with the same shape. Note this
// isn't "these event_types are always null" (double_accepted, for one,
// often carries a real, fully-analyzed cube_pass decision) — it's "when
// THIS event_type's error_analysis happens to be null, it's confirmed safe
// to skip" (verified by checking the surrounding event sequence: the real
// decision is already captured by a preceding double_requested/similar
// event — see docs/field-mapping.md). Since we can't know every event_type
// this might appear under, anything outside this confirmed-safe list gets
// logged loudly (console.warn + summary warnings) instead of being
// silently trusted forever — only add a type here once its null case has
// actually been checked in context, the way double_rejected/double_accepted
// were.
const EVENT_TYPES_SAFE_FOR_NULL_ERROR_ANALYSIS = new Set([
  "game_started",
  "game_over",
  "turn_forfeited",
  "double_rejected",
  "double_accepted",
]);

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
  // Events with a real reviews[0] whose metadata.count_as_decision is
  // false — still upserted as a Decision row exactly as before (this step
  // doesn't change that), so this is a visibility-only counter, not an
  // exclusive bucket: an event counted here may also be counted in
  // decisionsIngested above.
  decisionsSkippedNotCounted: number;
  // Events with no reviews at all — game_started/game_over/turn_forfeited
  // (which never carry a meaningful review; see NON_DECISION_EVENT_TYPES)
  // plus any other event type whose reviews array happened to be empty.
  eventsSkippedNoReview: number;
  errors: string[];
  // Non-fatal: an event with error_analysis: null was skipped under an
  // event_type not in EVENT_TYPES_SAFE_FOR_NULL_ERROR_ANALYSIS. Doesn't
  // count against the match's success (unlike errors) — just surfaces that
  // something unconfirmed was seen, in case it turns out to be a real
  // decision shape that should be handled properly instead of skipped.
  warnings: string[];
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

// Only ever reads cube_analysis for the two event types that actually carry
// it — never as a fallback/else, since "resignation" (and any other future
// analysed_event) has no cube_analysis at all and would crash on one.
function buildCubeDetail(review: Review): string | null {
  if (review.result.analysed_event !== "cube_double" && review.result.analysed_event !== "cube_pass") {
    return null;
  }
  const cube = review.result.result.cube_analysis;

  if (review.result.analysed_event === "cube_double") {
    const mine = review.double ? "doubled" : "did not double";
    return `${mine} — best: ${cube.doublers_best_action.replace(/_/g, " ")}`;
  }

  const mine = review.take ? "took" : "passed";
  return `${mine} — best: ${cube.receivers_best_action.replace(/_/g, " ")}`;
}

// Resignation-only fields (resign_error/should_resign/resignation_type/
// equity_before/equity_after) — null for every other kind, same convention
// as notationPlayed/notationBest/cubeDetail being null outside their kind.
function buildResignationDetail(review: Review): {
  resignError: number | null;
  shouldResign: boolean | null;
  resignationType: string | null;
  equityBefore: number | null;
  equityAfter: number | null;
} {
  if (review.result.analysed_event !== "resignation") {
    return {
      resignError: null,
      shouldResign: null,
      resignationType: null,
      equityBefore: null,
      equityAfter: null,
    };
  }

  const result = review.result.result;
  return {
    resignError: result.resign_error,
    shouldResign: result.should_resign,
    resignationType: result.resignation_type,
    equityBefore: result.equity_before,
    equityAfter: result.equity_after,
  };
}

// The only place that decides what analysed_event values are known. Returns
// null for anything outside the four confirmed shapes (move/cube_double/
// cube_pass/resignation) so the caller can log and skip instead of guessing
// a kind — this is deliberately not a fallback/else, so a fifth future shape
// surfaces as a warning instead of silently being miscounted as CUBE.
function decisionKindFor(analysedEvent: string): DecisionKind | null {
  switch (analysedEvent) {
    case "move":
      return DecisionKind.CHECKER;
    case "cube_double":
    case "cube_pass":
      return DecisionKind.CUBE;
    case "resignation":
      return DecisionKind.RESIGNATION;
    default:
      return null;
  }
}

export async function ingestMatch(
  matchId: number,
  indexData: MatchIndexData,
  token: string
): Promise<IngestSummary> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let gamesIngested = 0;
  let decisionsIngested = 0;
  let decisionsSkippedNotCounted = 0;
  let eventsSkippedNoReview = 0;
  let matchLength: number | null = null;
  const gamePlayedAts: Date[] = [];

  // matchId here is the Galaxy match ID (what the URL/UI use) — Match.id is
  // now an internal auto-increment key, resolved via the (source,
  // sourceMatchId) compound unique instead of being the primary key itself.
  const sourceMatchId = String(matchId);
  const match = await prisma.match.upsert({
    where: { source_sourceMatchId: { source: SOURCE, sourceMatchId } },
    create: { source: SOURCE, sourceMatchId, ...indexData },
    update: { ...indexData },
  });

  // Opponent identity resolution: a match is 1v1, so any user_id seen in
  // this match's events that isn't "you" is unambiguously the opponent.
  // Requires the "you" PlayerIdentity row to already exist (upserted during
  // index-sync — see lib/sync.ts — or by visiting /galaxy/matches, which
  // does the same upsert); if it doesn't, opponentUserId simply never gets
  // set and no opponent row is written for this call, rather than risking
  // misidentifying your own user_id as the opponent's.
  const me = await prisma.playerIdentity.findFirst({ where: { source: SOURCE, isMe: true } });
  let opponentUserId: string | null = null;

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
      where: { matchId_gameIndex: { matchId: match.id, gameIndex } },
      create: { matchId: match.id, gameIndex },
      update: {},
    });

    // Cube ownership isn't in the payload directly — walk this game's
    // cube-kind decisions in order, tracking who last took a double.
    let cubeOwner: string | null = null;
    const decisionTimestamps: Date[] = [];

    for (const event of response.data.events) {
      if (me && opponentUserId === null && event.user_id && event.user_id !== me.sourceUserId) {
        opponentUserId = event.user_id;
      }

      if (NON_DECISION_EVENT_TYPES.has(event.event_type)) {
        eventsSkippedNoReview++;
        continue;
      }

      const review = event.reviews?.[0];
      if (!review) {
        eventsSkippedNoReview++;
        continue;
      }

      try {
        const analysedEvent = review.result.analysed_event;
        const kind = decisionKindFor(analysedEvent);

        // Unrecognized analysed_event — surface it loudly rather than
        // guessing a kind (the old code defaulted anything non-"move" to
        // CUBE, which is exactly what silently broke on "resignation").
        // This guard is permanent, not just for resignation: any future
        // fifth shape lands here too.
        if (kind === null) {
          const message = `match ${matchId} game ${gameIndex} event ${event.id}: unrecognized analysed_event "${analysedEvent}", skipped`;
          console.warn(message);
          warnings.push(message);
          continue;
        }

        const metadata = review.result.result.metadata;
        const errorAnalysis = review.result.result.error_analysis;
        const probabilities = review.result.result.probabilities;

        // Visibility only — still upserted below exactly as before regardless
        // of this flag (filtering by it happens at read time, per
        // docs/field-mapping.md), so this doesn't gate anything.
        if (!metadata.count_as_decision) {
          decisionsSkippedNotCounted++;
        }

        // Outcome-logging event with nothing to grade — see the comment on
        // EVENT_TYPES_SAFE_FOR_NULL_ERROR_ANALYSIS above.
        if (errorAnalysis === null) {
          if (!EVENT_TYPES_SAFE_FOR_NULL_ERROR_ANALYSIS.has(event.event_type)) {
            const message = `match ${matchId} game ${gameIndex} event ${event.id}: unconfirmed event_type "${event.event_type}" with null error_analysis, skipped`;
            console.warn(message);
            warnings.push(message);
          }
          continue;
        }

        // Classification always comes from source_position, never
        // destination_position: the analysis is about the quality of a
        // decision made AT a position, so the phase that matters is the
        // board state before the move (source), not after (destination).
        // Falling back to destination would silently mislabel the decision's
        // phase, so a missing source classification is a hard failure for
        // this decision rather than a silent substitution.
        const classification = review.source_position?.classification;
        if (!classification) {
          throw new Error("missing source_position.classification");
        }

        // Owner entering this decision, before applying its own outcome.
        const cubeOwnerUserId = kind === DecisionKind.CUBE ? cubeOwner : null;
        if (kind === DecisionKind.CUBE && analysedEvent === "cube_pass" && review.take === true) {
          cubeOwner = event.user_id;
        }

        const { played, best } = moveNotations(review);
        const resignation = buildResignationDetail(review);
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
          matchScoreBlack: metadata.scores?.black ?? null,
          matchScoreWhite: metadata.scores?.white ?? null,
          crawfordState: metadata.crawford_state,
          cubeOwnerUserId,
          notationPlayed: played,
          notationBest: best,
          cubeDetail: buildCubeDetail(review),
          resignError: resignation.resignError,
          shouldResign: resignation.shouldResign,
          resignationType: resignation.resignationType,
          equityBefore: resignation.equityBefore,
          equityAfter: resignation.equityAfter,
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
    await prisma.match.update({ where: { id: match.id }, data: matchUpdate });
  }

  // Reflects this match's own currently-known opponentName on every
  // (re-)ingest — not a cross-match "most recent name wins" comparison the
  // way the one-time backfill script (scripts/backfill-opponent-identities.ts)
  // does; a match re-synced out of chronological order could in theory
  // regress a displayName that a newer match already set. Acceptable here:
  // display-name changes are rare, and matches are normally processed
  // roughly in order by the resumable sync loop.
  if (opponentUserId) {
    try {
      await prisma.playerIdentity.upsert({
        where: { source_sourceUserId: { source: SOURCE, sourceUserId: opponentUserId } },
        create: {
          source: SOURCE,
          sourceUserId: opponentUserId,
          displayName: indexData.opponentName,
          isMe: false,
        },
        update: { displayName: indexData.opponentName },
      });
    } catch (e) {
      console.error(`Failed to upsert opponent PlayerIdentity for match ${matchId}:`, e);
    }
  }

  return {
    matchId,
    gamesIngested,
    decisionsIngested,
    decisionsSkippedNotCounted,
    eventsSkippedNoReview,
    errors,
    warnings,
  };
}
