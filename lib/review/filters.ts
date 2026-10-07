// The review filters (/review and /review/cards): tag, phase, type
// (checker/cube) and severity, read from URL params and turned into a
// Prisma where on the card's Decision. Pure (no client), same param names
// and values as /mistakes (lib/listParams.ts), so the same FilterSelect
// options work.
import type { Prisma } from "@/lib/generated/prisma/client";
import { resolvePhaseWhere } from "@/lib/classificationLabels";
import { categoryFromParam, severityFromParam } from "@/lib/listParams";

export interface ReviewFilters {
  // Tag.id, as a string param.
  tag: string | undefined;
  phase: string | undefined;
  category: string | undefined;
  severity: string | undefined;
}

type ParamReader = (key: string) => string | undefined;

export function reviewFiltersFrom(get: ParamReader): ReviewFilters {
  const lower = (key: string) => get(key)?.toLowerCase() || undefined;
  return {
    tag: get("tag") || undefined,
    phase: get("phase") || undefined,
    category: lower("category"),
    severity: lower("severity"),
  };
}

export function tagIdFromParam(param: string | undefined): number | undefined {
  if (!param || !/^[1-9]\d*$/.test(param)) return undefined;
  const n = Number(param);
  return Number.isSafeInteger(n) ? n : undefined;
}

// Where on Decision for the filters. Unknown values mean "no filter on that
// column" (as on /mistakes); an unknown tag id matches nothing, which is
// what it means.
export function reviewDecisionWhere(filters: ReviewFilters): Prisma.DecisionWhereInput {
  const where: Prisma.DecisionWhereInput = {};
  const tagId = tagIdFromParam(filters.tag);
  if (tagId !== undefined) where.tags = { some: { tagId } };
  if (filters.phase) Object.assign(where, resolvePhaseWhere(filters.phase));
  const kind = categoryFromParam(filters.category);
  if (kind) where.kind = kind;
  const errorSeverity = severityFromParam(filters.severity);
  if (errorSeverity) where.errorSeverity = errorSeverity;
  return where;
}

// The filters as URL params (empty ones left out), for links and fetches.
export function reviewFilterParams(filters: ReviewFilters): Record<string, string | undefined> {
  return { tag: filters.tag, phase: filters.phase, category: filters.category, severity: filters.severity };
}
