// Single-match ingest: pulls a match's games from Galaxy (via galaxy-client,
// same fetch behavior as everywhere else) and writes Match/Game/Decision
// rows. Triggered manually, per match, from the "Sync" button on
// /galaxy/matches — no scheduler, no multi-match loop yet (that's a later
// upgrade; this function is already shaped so looping it over several
// matchIds is just a caller-side change).
import { prisma } from "@/lib/prisma";
import { createGalaxyClient } from "@/lib/galaxy-client";
import { DecisionKind, ErrorSeverity, Prisma } from "@/lib/generated/prisma/client";
import type { GameEvent, Review } from "@/lib/gameReviewsTypes";
import { actionLabels, findPrecedingRoll } from "@/lib/mistakes";
import {
  PlayerUserIds,
  addSeatEvidence,
  decodeGnuMatchId,
  effectiveMatchLength,
  gameScoreFromMatchId,
  type DecodedMatchId,
} from "@/lib/gnuMatchId";

// How many of a game's own CHECKER decisions get a plyNumber at all —
// deeper plies aren't a useful filter dimension (see Decision.plyNumber's
// own schema comment).
const MAX_TRACKED_PLY = 4;

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

// The Match columns a caller supplies from Galaxy's analyses/list entry —
// the only fields the /api/galaxy/matches/[matchId]/sync route accepts from
// its request body. Everything else on Match (id, source, sourceMatchId,
// ingestStatus, ingestError, matchLength, playedAt, createdAt) is set by
// the server alone.
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

// Allow-list copy: exactly the 8 MatchIndexData fields, nothing else. The
// sync route's body is client-supplied JSON cast to MatchIndexData, so the
// static type alone guarantees nothing at runtime — spreading it into the
// Match upsert let a caller set any column (id, ingestStatus, …). Written
// out field by field (not a key list) so the compiler rejects a missing
// field, and an object literal can't pick up an extra one.
export function pickMatchIndexData(d: MatchIndexData): MatchIndexData {
  return {
    opponentName: d.opponentName,
    opponentCountry: d.opponentCountry,
    opponentRating: d.opponentRating,
    opponentError: d.opponentError,
    opponentScore: d.opponentScore,
    userError: d.userError,
    userRating: d.userRating,
    userScore: d.userScore,
  };
}

// Validates an untrusted value (a request body's indexData) as
// MatchIndexData: an object with all 8 fields, strings as strings and
// numbers as finite numbers. Returns only those 8 (extra keys dropped), or
// null if any is missing or the wrong type. No stricter than the Match
// columns themselves — Prisma would reject the same bad values later, just
// as an opaque 502 instead of a 400.
export function parseMatchIndexData(input: unknown): MatchIndexData | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const isStr = (k: string) => Object.hasOwn(o, k) && typeof o[k] === "string";
  const isNum = (k: string) => Object.hasOwn(o, k) && typeof o[k] === "number" && Number.isFinite(o[k]);
  if (!isStr("opponentName") || !isStr("opponentCountry")) return null;
  for (const k of ["opponentRating", "opponentError", "opponentScore", "userError", "userRating", "userScore"]) {
    if (!isNum(k)) return null;
  }
  return pickMatchIndexData(o as unknown as MatchIndexData);
}

export interface IngestSummary {
  matchId: number;
  gamesIngested: number;
  decisionsIngested: number;
  // Events with a real reviews[0] whose metadata.count_as_decision is
  // false — still upserted as a Decision row, so this is a visibility-only
  // counter, not an
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

// Resignation-only fields (resign_error/should_resign/resignation_type/
// equity_before/equity_after) — null for every other kind, same convention
// as movePlayed/moveBest/cubeActionPlayed/cubeActionBest being null outside
// their kind.
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

// Ordinal position (1, 2, 3, ...) among this game's own CHECKER decisions,
// ordered by eventId ascending — computed once per game, up front, rather
// than via a running counter as events are processed in whatever order the
// API happens to return them (confirmed elsewhere in this file, see the
// playedAt comment below, that events aren't assumed to already be in
// eventId order). Eligibility mirrors exactly what actually becomes a
// CHECKER Decision row further down this file: has a review, resolves to
// CHECKER kind, and error_analysis isn't null (an event failing either
// check never gets a Decision row at all, so it must never consume a ply
// slot either). Returns a lookup from eventId -> plyNumber for only the
// first MAX_TRACKED_PLY such events; every other CHECKER event's plyNumber
// is null (see Decision.plyNumber's own schema comment for why deeper plies
// aren't tracked).
function checkerPlyByEventId(events: GameEvent[]): Map<number, number> {
  const orderedEventIds = events
    .filter((event) => {
      const review = event.reviews?.[0];
      if (!review) return false;
      if (decisionKindFor(review.result.analysed_event) !== DecisionKind.CHECKER) return false;
      return review.result.result.error_analysis !== null;
    })
    .map((event) => event.id)
    .sort((a, b) => a - b);

  const plyByEventId = new Map<number, number>();
  orderedEventIds.slice(0, MAX_TRACKED_PLY).forEach((eventId, index) => {
    plyByEventId.set(eventId, index + 1);
  });
  return plyByEventId;
}

// Precomputes Decision.roll for every event in the game, using the exact
// same findPrecedingRoll backward scan lib/mistakes.ts's extractDecisions/
// lib/decisionFromRow.ts's (now-removed) buildRollLookup already used at
// read time — see reports/2026-10-02-step4-dice-roll-column-design.md for
// the full equivalence verification, including a confirmed-dead fallback
// branch in the old read-time code that this intentionally does NOT
// replicate (it was never actually live, so replicating it would be a
// behavior change, not a faithful relocation).
//
// Applied unconditionally for every kind (not gated to CHECKER) — matches
// the DB-row read paths' real current behavior, not extractDecisions' own
// kind === "checker" gating (a separate, pre-existing divergence between
// the two paths, not addressed here).
//
// Operates on the full in-memory events array (same one passed to
// checkerPlyByEventId above) — includes game_started/game_over/
// turn_forfeited events even though they're never stored as their own
// Decision row, so a first move whose roll came from game_started.
// rolled_dice (confirmed possible — see
// lib/__fixtures__/galaxy-payloads/game-started-game-over.json) is
// captured correctly here, unlike scripts/backfill-decision-roll.ts, which
// can only see what's already stored.
function rollByEventId(events: GameEvent[]): Map<number, number[] | null> {
  const result = new Map<number, number[] | null>();
  events.forEach((event, index) => {
    const roll = findPrecedingRoll(events, index);
    result.set(event.id, roll.length > 0 ? roll : null);
  });
  return result;
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
  const gamePlayedAts: Date[] = [];
  // Match.matchLength = the GNU Match ID length (0 = money) of the match's
  // first decision: lowest gameIndex, then lowest eventId, with an even
  // decoded length read as money (effectiveMatchLength) — see
  // docs/field-mapping.md, "GNU Match ID". Built in ascending gameIndex
  // order, one entry per game whose first decision decodes.
  const gameMatchLengths: number[] = [];
  // Which userId sits in which GNU player seat (1 = black, 0 = white),
  // gathered across the whole match (colours are fixed per match) — maps
  // the Match ID's cube owner to a userId, and the user's own seat to
  // their scores.
  const players = new PlayerUserIds();

  // matchId here is the Galaxy match ID (what the URL/UI use) — Match.id is
  // now an internal auto-increment key, resolved via the (source,
  // sourceMatchId) compound unique instead of being the primary key itself.
  const sourceMatchId = String(matchId);
  // pickMatchIndexData, not a spread of indexData itself: callers can pass
  // a runtime object carrying more than the type says (see its comment).
  const indexFields = pickMatchIndexData(indexData);
  const match = await prisma.match.upsert({
    where: { source_sourceMatchId: { source: SOURCE, sourceMatchId } },
    create: { source: SOURCE, sourceMatchId, ...indexFields },
    update: indexFields,
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

    // Game.playedAt = metadata.timestamp of this game's first decision *by
    // eventId* (not earliest timestamp value, and not assumed to already be
    // in eventId order from the API) with a populated error_analysis.
    // metadata.timestamp is NOT a real play-time source in general — it's
    // stamped with when Galaxy served that analysis, confirmed by re-fetching
    // the same event and watching it advance in real time (see
    // docs/field-mapping.md's playedAt section for the investigation). This
    // rule is a deliberate, known-imperfect choice: for a match ingested
    // shortly after being played (the normal case going forward, via
    // incremental sync), "first request for this match" and "played" are
    // close enough to be useful; it only breaks down for a large historical
    // backfill run months/years after the fact, which is exactly what
    // happened for this app's original 2026-09 backfill (see
    // scripts/backfill-played-at.ts for the one-time consequence of that).
    const decisionTimestampsByEventId: { eventId: number; timestamp: Date }[] = [];
    // Game.userScore/opponentScore/crawfordState and (via gameMatchLengths)
    // Match.matchLength all come from the GNU Match ID of this game's first
    // stored decision by eventId. Replaces the metadata.scores reading
    // (2026-10-06): metadata.scores.white is the score of the player on
    // roll, not a colour's or the actor's, and it's null on Galaxy's older
    // analyses — see docs/field-mapping.md, "GNU Match ID".
    let firstDecision: { eventId: number; matchId: DecodedMatchId | null } | null = null;
    const plyByEventId = checkerPlyByEventId(response.data.events);
    const rollByEvent = rollByEventId(response.data.events);

    // Seat evidence for `players`, from every event before any row is
    // written, so a cube owner whose first appearance comes later in the
    // game still resolves.
    for (const event of response.data.events) {
      const review = event.reviews?.[0];
      addSeatEvidence(players, {
        userId: event.user_id,
        color: event.color,
        analysedEvent: review?.result.analysed_event,
        matchId: decodeGnuMatchId(review?.source_match?.formatted_value),
      });
    }

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

        // Visibility only — the row is upserted below regardless of this
        // flag (filtering by it happens at read time, per
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

        // Cube entering this decision, every kind, straight from the
        // decision's own GNU Match ID (2026-10-06; replaces the take-walk,
        // which missed takes on ~22% of rows). Owner seat -> userId via
        // `players`; centred -> null. A Match ID that doesn't decode, or an
        // owner seat no userId can be matched to, stores no cube and
        // cubeConfident = false, with a warning.
        const matchState = decodeGnuMatchId(review.source_match?.formatted_value);
        const cubeOwnerUserId =
          matchState && matchState.cubeOwner !== null ? players.userIdFor(matchState.cubeOwner) : null;
        const cubeConfident =
          matchState !== null && (matchState.cubeOwner === null || cubeOwnerUserId !== null);
        const cubeValue = cubeConfident ? matchState!.cubeValue : null;
        if (!cubeConfident) {
          const message = matchState
            ? `match ${matchId} game ${gameIndex} event ${event.id}: cube owner seat ${matchState.cubeOwner} has no known userId, cube left unset`
            : `match ${matchId} game ${gameIndex} event ${event.id}: GNU Match ID missing or undecodable, cube left unset`;
          console.warn(message);
          warnings.push(message);
        }

        // The same mine/best short labels lib/mistakes.ts's actionLabels()
        // already computes at read time for display — reused directly
        // (not reimplemented) rather than the old bespoke buildCubeDetail,
        // which composed the same two raw fields into one string. Gated to
        // CUBE kind only — RESIGNATION's own labels deliberately stay
        // read-time-computed, no column (see Decision.cubeActionPlayed's
        // schema comment / reports/2026-10-02-raw-field-reverification.md).
        const cubeLabels = kind === DecisionKind.CUBE ? actionLabels(review) : null;

        const { played, best } = moveNotations(review);
        const resignation = buildResignationDetail(review);
        const timestamp = new Date(metadata.timestamp);
        decisionTimestampsByEventId.push({ eventId: event.id, timestamp });
        if (firstDecision === null || event.id < firstDecision.eventId) {
          firstDecision = { eventId: event.id, matchId: matchState };
        }

        const decisionData = {
          userId: event.user_id,
          color: event.color,
          kind,
          analysedEvent,
          countAsDecision: metadata.count_as_decision,
          rawError: errorAnalysis.raw_error,
          errorSeverity: mapSeverity(errorAnalysis.error_severity),
          luck: errorAnalysis.luck,
          luckMwc: errorAnalysis.luck_mwc,
          equity: review.result.result.equity,
          mwc: probabilities.mwc_context !== null ? probabilities.mwc : null,
          classification,
          // Same source_position object classification is read from above;
          // GNU Position ID of the board before this decision. Confirmed
          // 100% real-data coverage (reports/2026-10-02-step3-
          // sourcepositionid-column-design.md), but read with the same
          // optional-chaining defensiveness as classification's own raw
          // access, just without the hard-fail — a column, not a required
          // domain fact ingest refuses to proceed without.
          sourcePositionId: review.source_position?.formatted_value ?? null,
          // Prisma's Json input type needs Prisma.DbNull, not a plain
          // `null`, to mean "set this column to SQL NULL" rather than
          // storing the JSON literal null value — unlike every other
          // nullable column on this model, which isn't Json-typed.
          roll: rollByEvent.get(event.id) ?? Prisma.DbNull,
          plyNumber: plyByEventId.get(event.id) ?? null,
          cubeOwnerUserId: cubeConfident ? cubeOwnerUserId : null,
          cubeValue,
          cubeConfident,
          movePlayed: played,
          moveBest: best,
          cubeActionPlayed: cubeLabels?.mine ?? null,
          cubeActionBest: cubeLabels?.best ?? null,
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

    if (decisionTimestampsByEventId.length > 0) {
      const first = decisionTimestampsByEventId.reduce((a, b) => (a.eventId < b.eventId ? a : b));
      await prisma.game.update({ where: { id: game.id }, data: { playedAt: first.timestamp } });
      gamePlayedAts.push(first.timestamp);
    }

    const firstState = firstDecision?.matchId ?? null;
    if (firstState) {
      await prisma.game.update({ where: { id: game.id }, data: gameScoreFromMatchId(firstState, players, me?.sourceUserId) });
      gameMatchLengths.push(effectiveMatchLength(firstState));
    }

    gamesIngested++;
  }

  const matchUpdate: { matchLength?: number; playedAt?: Date } = {};
  // gameMatchLengths is in ascending gameIndex order, so its first element
  // is the first decision's length — including 0 for a money game, and for
  // the ~30 single-game matches whose Match ID flips from 0 to 1 after a
  // double (the user's call: store the first decision's value).
  if (gameMatchLengths.length > 0) matchUpdate.matchLength = gameMatchLengths[0];
  // Match.playedAt = the Game.playedAt of the match's first game (lowest
  // gameIndex), not the earliest across all games — gamePlayedAts is built
  // in ascending gameIndex order by the loop above (only pushed for a game
  // that had at least one valid decision), so its first element is exactly
  // that lowest-gameIndex value.
  if (gamePlayedAts.length > 0) {
    matchUpdate.playedAt = gamePlayedAts[0];
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
