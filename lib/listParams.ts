// URL search-param handling shared by the two filtered, paginated server
// pages — /mistakes and /repeated-positions. Pure: no Prisma client, no
// React, so all of it is unit-testable.
import { DecisionKind, ErrorSeverity } from "@/lib/generated/prisma/enums";
import { getPhaseLabel } from "@/lib/classificationLabels";
import { severityLabel } from "@/lib/badges";

export type SearchParams = { [key: string]: string | string[] | undefined };

export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

// A single string value for `key`; repeated params (string[]) count as
// absent, same as a missing one.
export function stringParam(sp: SearchParams, key: string): string | undefined {
  const value = sp[key];
  return typeof value === "string" ? value : undefined;
}

export function lowercaseParam(sp: SearchParams, key: string): string | undefined {
  return stringParam(sp, key)?.toLowerCase();
}

export function positiveIntParam(sp: SearchParams, key: string): number | undefined {
  const raw = stringParam(sp, key);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export interface ListParams {
  phase: string | undefined;
  severityParam: string | undefined;
  page: number;
  pageSize: number;
}

// The params both pages share. ?phase= is the current param; ?classification=
// is accepted as an alias for it (only when phase itself isn't present) so
// old drill-down links from /matches/analysis
// (?classification=<value>&severity=<severity>) keep working unchanged — a
// raw classification value is already a valid Phase value (resolvePhaseWhere
// treats anything that isn't one of the fixed Phase options as a plain
// classification match). Out-of-range page / pageSize fall back to the
// defaults rather than erroring.
export function parseListParams(
  sp: SearchParams,
  { defaultPageSize }: { defaultPageSize: number }
): ListParams {
  const pageSizeParam = Number(stringParam(sp, "pageSize") ?? defaultPageSize);
  return {
    phase: stringParam(sp, "phase") ?? stringParam(sp, "classification"),
    severityParam: lowercaseParam(sp, "severity"),
    page: positiveIntParam(sp, "page") ?? 1,
    pageSize: (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeParam)
      ? pageSizeParam
      : defaultPageSize,
  };
}

// Lowercase URL value -> Prisma enum value.
export const SEVERITY_PARAM_MAP: Readonly<Record<string, ErrorSeverity>> = {
  blunder: ErrorSeverity.BLUNDER,
  error: ErrorSeverity.ERROR,
  doubtful: ErrorSeverity.DOUBTFUL,
  none: ErrorSeverity.NONE,
};

export const CATEGORY_PARAM_MAP: Readonly<Record<string, DecisionKind>> = {
  checker: DecisionKind.CHECKER,
  cube: DecisionKind.CUBE,
  resignation: DecisionKind.RESIGNATION,
};

// Own-property lookups: these values come straight from the URL, and a
// plain map[param] would resolve e.g. ?category=constructor to
// Object.prototype.constructor and hand a function to Prisma's where
// clause. An unknown value means "no filter on this column".
export function severityFromParam(param: string | undefined): ErrorSeverity | undefined {
  return param !== undefined && Object.hasOwn(SEVERITY_PARAM_MAP, param)
    ? SEVERITY_PARAM_MAP[param]
    : undefined;
}

export function categoryFromParam(param: string | undefined): DecisionKind | undefined {
  return param !== undefined && Object.hasOwn(CATEGORY_PARAM_MAP, param)
    ? CATEGORY_PARAM_MAP[param]
    : undefined;
}

// "?a=1&b=2" from the non-empty entries, or "" when there are none.
export function buildQueryString(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) sp.set(key, value);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function pageHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number
): string {
  return `${basePath}${buildQueryString({ ...params, page: String(page) })}`;
}

export function totalPagesFor(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

// The "<phase label> <other filters>" phrase in each page's result-count
// line ("1,234 2nd roll checker blunder decisions."), or "all" when no
// filter is set.
export function describeFilters(phase: string | undefined, ...others: (string | undefined)[]): string {
  return [phase ? getPhaseLabel(phase) : undefined, ...others].filter(Boolean).join(" ") || "all";
}

// The severity filter's name for a ?severity= value (Galaxy's "Best"/"Good"/
// "Error"/"Blunder"), or the value itself when it isn't a known one — for
// each page's result-count line.
export function severityParamLabel(param: string | undefined): string | undefined {
  const severity = severityFromParam(param);
  return severity ? severityLabel(severity) : param;
}

// Galaxy's order for the severity tiers, best first.
const SEVERITY_ORDER: readonly ErrorSeverity[] = [
  ErrorSeverity.NONE,
  ErrorSeverity.DOUBTFUL,
  ErrorSeverity.ERROR,
  ErrorSeverity.BLUNDER,
];

// Severity dropdown options: still submitted as the lowercase enum value
// (so existing links and filters keep working), shown with Galaxy's names,
// in Galaxy's order (Best, Good, Error, Blunder).
export function severityOptions(values: ErrorSeverity[]): { value: string; label: string }[] {
  const rank = (v: ErrorSeverity) => SEVERITY_ORDER.indexOf(v);
  return [...values]
    .sort((a, b) => rank(a) - rank(b))
    .map((v) => ({ value: v.toLowerCase(), label: severityLabel(v) }));
}

// Dropdown options for raw enum-ish DB values, shown and submitted
// lowercase (matching what lowercaseParam reads back).
export function lowercaseOptions(values: string[]): { value: string; label: string }[] {
  return values.map((v) => ({ value: v.toLowerCase(), label: v.toLowerCase() }));
}
