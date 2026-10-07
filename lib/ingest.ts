// Single-match ingest: pulls a match's games from Galaxy (via galaxy-client,
// same fetch behavior as everywhere else) and writes Match/Game/Decision
// rows. Triggered manually, per match, from the "Sync" button on
// /galaxy/matches — no scheduler, no multi-match loop yet (that's a later
// upgrade; this function is already shaped so looping it over several
// matchIds is just a caller-side change).
import { prisma } from "@/lib/prisma";
import { createGalaxyClient } from "@/lib/galaxy-client";
import { DecisionKind, ErrorSeverity } from "@/lib/generated/prisma/client";
import type { GameEvent } from "@/lib/gameReviewsTypes";
import { getDecisionAnalysis } from "@/lib/analysis";
import { decodeGnuMatchId } from "@/lib/gnuMatchId";

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
// ingestStatus, ingestError, playedAt, createdAt) is set by the server
// alone.
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
  // Also holds one line per analysisMissing decision below.
  warnings: string[];
  // Counted CHECKER/CUBE decisions whose raw the normalized-analysis
  // translator (lib/analysis/index.ts) couldn't read. Still stored; a
  // signal only, like warnings.
  analysisMissing: number;
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

export async function ingestMatch(
  matchId: number,
  indexData: MatchIndexData,
  token: string
): Promise<IngestSummary> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let analysisMissing = 0;
  let gamesIngested = 0;
  let decisionsIngested = 0;
  let decisionsSkippedNotCounted = 0;
  let eventsSkippedNoReview = 0;
  // Match.playedAt, computed in memory (no per-game copy is stored since
  // 2026-10-07): the first game, in gameIndex order, that has a decision
  // sets it — see the per-game comment below.
  let matchPlayedAt: Date | null = null;

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

    // This game's playedAt = metadata.timestamp of its first decision *by
    // eventId* (not earliest timestamp value, and not assumed to already be
    // in eventId order from the API) with a populated error_analysis; the
    // match's first such game sets Match.playedAt (Game.playedAt itself was
    // dropped 2026-10-07 — nothing read it).
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
    let firstDecision: { eventId: number; timestamp: Date } | null = null;
    const plyByEventId = checkerPlyByEventId(response.data.events);

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

        // The roll and cube a decision shows come from its own GNU Match ID
        // at read time (lib/analysis/index.ts; nothing is stored). A Match ID
        // that's missing or doesn't decode means no dice and no cube on the
        // board, so flag it — a signal, the row is stored either way.
        if (decodeGnuMatchId(review.source_match?.formatted_value) === null) {
          const message = `match ${matchId} game ${gameIndex} event ${event.id}: GNU Match ID missing or undecodable (no roll or cube will show), stored anyway`;
          console.warn(message);
          warnings.push(message);
        }

        const timestamp = new Date(metadata.timestamp);
        if (firstDecision === null || event.id < firstDecision.eventId) {
          firstDecision = { eventId: event.id, timestamp };
        }

        // The review cards derive a normalized analysis from `raw` on demand
        // (lib/analysis/index.ts; nothing is stored). Check here that every
        // counted CHECKER/CUBE decision's raw can be translated, so a
        // payload shape the translator can't read shows up at ingest rather
        // than as a blank card. A signal, not a blocker: the row is stored
        // either way. Resignations have no analysis by design. See
        // docs/field-mapping.md, "Normalized decision analysis (derived, not
        // stored)".
        if (
          metadata.count_as_decision &&
          errorAnalysis.raw_error !== null &&
          (kind === DecisionKind.CHECKER || kind === DecisionKind.CUBE) &&
          getDecisionAnalysis({ source: SOURCE, raw: event }) === null
        ) {
          analysisMissing++;
          const message = `match ${matchId} game ${gameIndex} event ${event.id}: no normalized analysis for counted "${analysedEvent}" decision (raw unreadable by the translator), stored anyway`;
          console.warn(message);
          warnings.push(message);
        }

        // Only what SQL filters, sorts, groups or counts by, plus raw. Every
        // other value (colour, event type, roll, cube, labels, notations,
        // resignation detail, luck/equity) is derived from raw on demand —
        // the columns that duplicated them were dropped 2026-10-07
        // (reports/2026-10-07-column-audit.md; docs/field-mapping.md,
        // "Derived from raw").
        const decisionData = {
          userId: event.user_id,
          kind,
          countAsDecision: metadata.count_as_decision,
          rawError: errorAnalysis.raw_error,
          errorSeverity: mapSeverity(errorAnalysis.error_severity),
          classification,
          // Same source_position object classification is read from above;
          // GNU Position ID of the board before this decision. Confirmed
          // 100% real-data coverage (reports/2026-10-02-step3-
          // sourcepositionid-column-design.md), but read with the same
          // optional-chaining defensiveness as classification's own raw
          // access, just without the hard-fail — a column, not a required
          // domain fact ingest refuses to proceed without.
          sourcePositionId: review.source_position?.formatted_value ?? null,
          plyNumber: plyByEventId.get(event.id) ?? null,
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

    if (firstDecision !== null && matchPlayedAt === null) {
      matchPlayedAt = firstDecision.timestamp;
    }

    gamesIngested++;
  }

  // Match.playedAt = the playedAt of the match's first game (lowest
  // gameIndex) that had a decision, not the earliest across all games.
  if (matchPlayedAt !== null) {
    await prisma.match.update({ where: { id: match.id }, data: { playedAt: matchPlayedAt } });
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
    analysisMissing,
  };
}
