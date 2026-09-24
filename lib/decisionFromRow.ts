// Builds a lib/mistakes.ts `Decision` (the exact shape BoardPanel already
// consumes, reused unmodified) directly from one already-ingested Decision
// DB row — no live Galaxy call, no surrounding game context needed. Each
// row is self-contained: its own `raw` JSON column holds the full original
// event (including reviews[0]), so the same label-derivation logic
// lib/mistakes.ts already uses for a live game_reviews fetch applies here
// unchanged, just reused via its exported actionLabels/moveNotations.
//
// Server-only (imports the Prisma-generated enum types) — never import this
// from a "use client" file; pass the resulting plain Decision objects down
// as props instead, the way app/mistakes/page.tsx does.
import type {
  DecisionKind as PrismaDecisionKind,
  ErrorSeverity as PrismaErrorSeverity,
} from "@/lib/generated/prisma/client";
import type { GameEvent } from "@/lib/gameReviewsTypes";
import { actionLabels, moveNotations, type Decision, type DecisionKind, type Severity } from "@/lib/mistakes";

const KIND_MAP: Record<PrismaDecisionKind, DecisionKind> = {
  CHECKER: "checker",
  CUBE: "cube",
  RESIGNATION: "resignation",
};

// DOUBTFUL is Galaxy's mildest graded-mistake tier. lib/mistakes.ts's own
// Severity type only has "error" | "blunder" (it computes severity from a
// threshold on absError, not from Galaxy's own classification at all) — and
// BoardPanel (reused exactly as-is here) only branches on
// `=== "blunder"` vs anything else, so DOUBTFUL maps to the closest
// existing bucket ("error") rather than extending that type. NONE means no
// real mistake, mapped to null to match lib/mistakes.ts's own convention
// for a clean decision.
function severityFor(severity: PrismaErrorSeverity): Severity | null {
  switch (severity) {
    case "BLUNDER":
      return "blunder";
    case "ERROR":
    case "DOUBTFUL":
      return "error";
    case "NONE":
      return null;
  }
}

export interface DecisionRow {
  id: number;
  userId: string;
  color: string;
  kind: PrismaDecisionKind;
  rawError: number | null;
  errorSeverity: PrismaErrorSeverity;
  raw: unknown;
  game: { gameIndex: number };
}

// Returns null for a row with no usable data (rawError null, or somehow no
// reviews[0] in its own raw JSON) — same "ungraded, skip it" treatment
// lib/mistakes.ts's own extractDecisions gives a null rawError, rather than
// crashing or faking a zero.
export function decisionFromRow(row: DecisionRow): Decision | null {
  if (row.rawError === null) return null;

  const event = row.raw as unknown as GameEvent;
  const review = event.reviews?.[0];
  if (!review) return null;

  const { mine, best } = actionLabels(review);
  const { mine: myMoveNotation, best: bestMoveNotation } = moveNotations(review);
  const absError = Math.abs(row.rawError);

  return {
    id: String(row.id),
    gameIndex: row.game.gameIndex,
    userId: row.userId,
    color: row.color,
    kind: KIND_MAP[row.kind],
    absError,
    isMistake: absError > 0,
    severity: severityFor(row.errorSeverity),
    detail:
      review.result.analysed_event === "move"
        ? `played ${mine} → best ${best}`
        : `${mine} → best: ${best}`,
    myLabel: mine,
    bestLabel: best,
    // A move_commited event's own rolled_dice is always empty (the real
    // roll lives on the preceding dice_rolled/game_started event) —
    // reconstructing it needs the full game's event sequence, which this
    // standalone, per-decision view deliberately doesn't fetch (see
    // app/mistakes/page.tsx). Falls back to this event's own rolled_dice,
    // which is only ever populated for event types other than
    // move_commited, so this is empty (BoardPanel already renders no dice
    // row for an empty roll) for the common checker-decision case here.
    roll: event.rolled_dice ?? [],
    sourcePositionId: review.source_position?.formatted_value ?? null,
    myMoveNotation,
    bestMoveNotation,
  };
}
