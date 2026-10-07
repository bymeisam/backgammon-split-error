// Builds what /review shows for one card from its stored row. Server-only
// (imports lib/decisionFromRow.ts, which uses Prisma's generated types).
// Every value comes from the decision's raw through lib/analysis/index.ts's
// dispatchers — this never reads a source's own format.
import type { Prisma } from "@/lib/generated/prisma/client";
import { decisionLabels, decisionMatchContext, decisionRoll, getDecisionAnalysis } from "@/lib/analysis";
import { DECISION_LIST_SELECT } from "@/lib/decisionQueries";
import { decisionFromRow, type DecisionListRow } from "@/lib/decisionFromRow";
import { externalMatchUrl } from "@/lib/externalMatchUrl";
import { reviewEligibility } from "@/lib/review/eligibility";
import { displayOptions, playedCheckerKey } from "@/lib/review/options";
import { formatMatchContext } from "@/lib/review/format";
import type { ReviewCardPayload } from "@/lib/review/types";

export const REVIEW_CARD_SELECT = {
  id: true,
  state: true,
  decision: { select: DECISION_LIST_SELECT },
} satisfies Prisma.ReviewCardSelect;

export interface ReviewCardRow {
  id: number;
  state: number;
  decision: DecisionListRow & { countAsDecision: boolean };
}

// Null when the decision is no longer eligible (e.g. its analysis can't be
// read): the card is skipped rather than shown broken.
export function buildCardPayload(card: ReviewCardRow, random: () => number = Math.random): ReviewCardPayload | null {
  const row = card.decision;
  const source = row.game.match.source;
  const input = { source, raw: row.raw };
  const eligibility = reviewEligibility({
    kind: row.kind,
    countAsDecision: row.countAsDecision,
    rawError: row.rawError,
    source,
    raw: row.raw,
  });
  if (!eligibility.eligible) return null;
  const decision = decisionFromRow(row);
  if (!decision) return null;

  const { analysis } = eligibility;
  const graded = displayOptions(analysis, random);
  const labels = decisionLabels(input);
  const { sourceMatchId } = row.game.match;

  return {
    cardId: card.id,
    decisionId: row.id,
    state: card.state,
    decision,
    question: analysis.kind === "checker" ? "checker" : analysis.role,
    options: graded.options,
    bestKey: graded.bestKey,
    playedKey: analysis.kind === "checker" ? playedCheckerKey(analysis) : null,
    playedLabel: labels?.mine ?? "?",
    cube: analysis.kind === "cube" ? { nd: analysis.nd, dt: analysis.dt, dp: analysis.dp } : null,
    matchContext: formatMatchContext(decisionMatchContext(input)),
    classification: row.classification,
    replayHref: `/matches/${encodeURIComponent(sourceMatchId)}/replay/${row.game.gameIndex}?decision=${row.id}`,
    externalHref: externalMatchUrl(source, sourceMatchId),
  };
}

// One row of /review/cards: a short text description of the position (no
// thumbnail exists yet), derived from raw through the dispatchers.
export function cardListSummary(row: DecisionListRow): { type: "Checker" | "Cube"; text: string } {
  const input = { source: row.game.match.source, raw: row.raw };
  const labels = decisionLabels(input);
  if (row.kind === "CHECKER") {
    const roll = decisionRoll(input);
    const dice = roll.length === 2 ? `${roll[0]}-${roll[1]}` : "?";
    return { type: "Checker", text: `${dice} · played ${labels?.mine ?? "?"}` };
  }
  const analysis = getDecisionAnalysis(input);
  const role = analysis?.kind === "cube" ? (analysis.role === "doubler" ? "Doubler" : "Receiver") : "Cube";
  return { type: "Cube", text: `${role} · played ${labels?.mine ?? "?"}` };
}
