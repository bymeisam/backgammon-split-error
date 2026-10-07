// Which decisions can become review cards. Pure (no Prisma, no React), so
// the API routes, the server pages and the client share one rule.
//
// A decision is eligible when all of these hold:
//   - it's counted: countAsDecision true and rawError not null (the same
//     "graded decision" rule the mistake lists use);
//   - its kind is CHECKER or CUBE — resignations are never eligible;
//   - its match's source has a translator (lib/analysis/index.ts);
//   - getDecisionAnalysis returns non-null for it, of the matching kind;
//   - a checker move has at least 2 candidates (a forced move has nothing
//     to choose between).
// Any player's decision qualifies: the user studies their opponents'
// decisions too.
//
// Everything about the decision comes from `raw` through the dispatcher;
// this never reads Galaxy's format itself. See docs/field-mapping.md,
// "Review cards".
import { getDecisionAnalysis, hasAnalysisTranslator } from "@/lib/analysis";
import type { DecisionAnalysis } from "@/lib/analysis/types";

export type EligibilityKind = "CHECKER" | "CUBE" | "RESIGNATION";

export interface EligibilityInput {
  kind: EligibilityKind;
  countAsDecision: boolean;
  rawError: number | null;
  // Match.source
  source: string;
  // Decision.raw
  raw: unknown;
}

export type IneligibleReason =
  | "not-counted"
  | "resignation"
  | "no-translator"
  | "no-analysis"
  | "forced-move";

export type Eligibility =
  | { eligible: true; analysis: DecisionAnalysis }
  | { eligible: false; reason: IneligibleReason };

export function reviewEligibility(input: EligibilityInput): Eligibility {
  if (!input.countAsDecision || input.rawError === null) return { eligible: false, reason: "not-counted" };
  if (input.kind === "RESIGNATION") return { eligible: false, reason: "resignation" };
  if (!hasAnalysisTranslator(input.source)) return { eligible: false, reason: "no-translator" };

  const analysis = getDecisionAnalysis({ source: input.source, raw: input.raw });
  if (!analysis) return { eligible: false, reason: "no-analysis" };
  const expected = input.kind === "CHECKER" ? "checker" : "cube";
  if (analysis.kind !== expected) return { eligible: false, reason: "no-analysis" };
  if (analysis.kind === "checker" && analysis.candidates.length < 2) {
    return { eligible: false, reason: "forced-move" };
  }
  return { eligible: true, analysis };
}

export function isReviewEligible(input: EligibilityInput): boolean {
  return reviewEligibility(input).eligible;
}
