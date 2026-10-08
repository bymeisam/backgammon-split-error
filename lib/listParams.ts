// URL search-param handling shared by the two filtered, paginated server
// pages — /mistakes and /repeated-positions. Pure: no Prisma client, no
// React, so all of it is unit-testable.
import { DecisionKind, ErrorSeverity } from "@/lib/generated/prisma/enums";
import { getPhaseLabel, resolvePhaseWhere } from "@/lib/classificationLabels";
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

// The kinds a decision list or filter ever shows. Resignations are left out
// of every mistake list, filter and stat (since 2026-10-07): they only
// appear as steps in the game replay. ?category=resignation is therefore an
// unknown value, which means "no filter" — i.e. these two kinds.
export const LISTED_KINDS: readonly DecisionKind[] = [DecisionKind.CHECKER, DecisionKind.CUBE];

export const CATEGORY_PARAM_MAP: Readonly<Record<string, DecisionKind>> = {
  checker: DecisionKind.CHECKER,
  cube: DecisionKind.CUBE,
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

// A category's display name: "Checker" / "Cube", from a DecisionKind value
// or a ?category= param (any case); an unknown one is shown as itself.
const CATEGORY_LABELS: Readonly<Record<string, string>> = { checker: "Checker", cube: "Cube" };

export function categoryLabel(value: string): string {
  const key = value.toLowerCase();
  return Object.hasOwn(CATEGORY_LABELS, key) ? CATEGORY_LABELS[key] : value;
}

// Each page's result-count line, lower-cased: "39,028 checker blunders",
// "12 2nd roll cube decisions". On /mistakes an Error or Blunder severity is
// the noun itself ("errors", "blunders"); Best and Good stay adjectives
// ("good decisions"), as every severity does for repeated positions. The
// phase and category come first.
export function describeResultCount(
  total: number,
  opts: {
    phase?: string;
    category?: string;
    severity?: ErrorSeverity;
    noun: "decision" | "repeated position";
  }
): string {
  const words: string[] = [];
  if (opts.phase) words.push(getPhaseLabel(opts.phase).toLowerCase());
  if (opts.category) words.push(categoryLabel(opts.category).toLowerCase());
  let noun: string = opts.noun;
  if (opts.severity) {
    const sev = severityLabel(opts.severity).toLowerCase();
    const isNoun =
      opts.noun === "decision" && (opts.severity === ErrorSeverity.ERROR || opts.severity === ErrorSeverity.BLUNDER);
    if (isNoun) noun = sev;
    else words.push(sev);
  }
  return [total.toLocaleString(), ...words, total === 1 ? noun : `${noun}s`].join(" ");
}

// The one-line summary next to a page's Filter button: each filter's value,
// or its "any" wording when it isn't set ("Any phase · All severities").
export function filterSummary(parts: readonly [value: string | undefined, whenUnset: string][]): string {
  return parts.map(([value, whenUnset]) => value ?? whenUnset).join(" · ");
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

// The category dropdown's options: the DecisionKind values submitted
// lowercase (what lowercaseParam reads back), shown as "Checker"/"Cube".
export function categoryOptions(values: string[]): { value: string; label: string }[] {
  return values.map((v) => ({ value: v.toLowerCase(), label: categoryLabel(v) }));
}

// /mistakes' decision filter, as a Prisma where — shared by the page's own
// list and "Add all to review" (app/api/review/bulk), so the bulk add takes
// exactly the decisions the list shows. Only decisions Galaxy counts
// (countAsDecision: true) with a rawError (a null one is an ungraded,
// partial analysis — see docs/field-mapping.md); checker and cube only
// (LISTED_KINDS). An unrecognised ?category= (including a stale
// ?category=resignation) means no category filter.
export function mistakesWhere(filters: {
  phase: string | undefined;
  categoryParam: string | undefined;
  severityParam: string | undefined;
}) {
  const category = categoryFromParam(filters.categoryParam);
  const errorSeverity = severityFromParam(filters.severityParam);
  return {
    countAsDecision: true,
    rawError: { not: null },
    ...(filters.phase ? resolvePhaseWhere(filters.phase) : {}),
    kind: category ?? { in: [...LISTED_KINDS] },
    ...(errorSeverity ? { errorSeverity } : {}),
  };
}
