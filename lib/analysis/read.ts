// Reads Decision.analysis back from the DB with runtime validation: the
// column is plain JSON, so its shape isn't guaranteed by the type system.
// Anything that isn't a valid DecisionAnalysis of a known version and source
// returns null, so callers treat it like a decision with no analysis.
// See lib/analysis/types.ts and docs/field-mapping.md, "Decision.analysis".
import {
  ANALYSIS_VERSION,
  type AnalysisSource,
  type CandidateProbs,
  type CheckerCandidate,
  type DecisionAnalysis,
} from "@/lib/analysis/types";

const SOURCES: ReadonlySet<string> = new Set<AnalysisSource>(["galaxy"]);

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readProbs(p: unknown): CandidateProbs | null | undefined {
  if (p === null) return null;
  if (!isObject(p)) return undefined;
  const { win, winG, winBG, loseG, loseBG } = p;
  if (!isNum(win) || !isNum(winG) || !isNum(winBG) || !isNum(loseG) || !isNum(loseBG)) return undefined;
  return { win, winG, winBG, loseG, loseBG };
}

function readCandidate(c: unknown): CheckerCandidate | null {
  if (!isObject(c)) return null;
  const { move, rank, equity, loss, played } = c;
  if (typeof move !== "string" || !isNum(rank) || !isNum(equity) || !isNum(loss) || loss > 0) return null;
  if (typeof played !== "boolean") return null;
  const probs = readProbs(c.probs);
  if (probs === undefined) return null;
  return { move, rank, equity, loss, played, probs };
}

// `json` is the column value as Prisma returns it (already parsed). A string
// is parsed first, for raw-SQL callers that get the JSON text back.
export function readAnalysis(json: unknown): DecisionAnalysis | null {
  let value = json;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!isObject(value)) return null;
  if (value.v !== ANALYSIS_VERSION) return null;
  if (typeof value.source !== "string" || !SOURCES.has(value.source)) return null;
  const source = value.source as AnalysisSource;

  if (value.kind === "checker") {
    if (!Array.isArray(value.candidates) || value.candidates.length === 0) return null;
    const candidates: CheckerCandidate[] = [];
    for (const c of value.candidates) {
      const candidate = readCandidate(c);
      if (!candidate) return null;
      candidates.push(candidate);
    }
    if (candidates.filter((c) => c.played).length !== 1) return null;
    return { v: 1, source, kind: "checker", candidates };
  }

  if (value.kind === "cube") {
    const { role, nd, dt, dp } = value;
    if (role !== "doubler" && role !== "receiver") return null;
    if (!isNum(nd) || !isNum(dt) || !isNum(dp)) return null;
    return { v: 1, source, kind: "cube", role, nd, dt, dp };
  }

  return null;
}
