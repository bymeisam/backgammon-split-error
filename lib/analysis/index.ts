// The single entry point for a decision's normalized engine analysis
// (lib/analysis/types.ts's DecisionAnalysis). Nothing is stored: the
// analysis is derived on demand from the decision's own `raw` by the
// translator for its Match.source. Callers (the review cards, ingest's
// check) never pick a translator themselves.
//
// Adding a source (e.g. an XG import): write its translator next to
// lib/analysis/galaxy.ts, filling the same shape, and add a case below.
// Every translator is pure and only reads `raw`; `raw` is the source's
// untouched payload and is never modified or written back.
//
// See docs/field-mapping.md, "Normalized decision analysis (derived, not
// stored)".
import { galaxyAnalysis } from "@/lib/analysis/galaxy";
import type { DecisionAnalysis } from "@/lib/analysis/types";

export type DecisionAnalysisInput = {
  // Match.source of the decision's match ("galaxy").
  source: string;
  // Decision.raw, the source's stored event.
  raw: unknown;
  // Decision.analysedEvent.
  analysedEvent: string;
};

// Null for an unknown source, a resignation, or a payload the translator
// can't read.
export function getDecisionAnalysis({ source, raw, analysedEvent }: DecisionAnalysisInput): DecisionAnalysis | null {
  switch (source) {
    case "galaxy":
      return galaxyAnalysis(raw, analysedEvent);
    default:
      return null;
  }
}
