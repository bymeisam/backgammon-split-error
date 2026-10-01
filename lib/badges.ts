import type { ErrorSeverity } from "@/lib/generated/prisma/enums";
import { CLASSIFICATION_LABELS_BY_RAW_VALUE } from "@/lib/classificationLabels";

// What app/components/ui/Badge.tsx renders. Lives here, with the config
// maps built from it, rather than in the component file — lib/ shouldn't
// import from app/.
export type BadgeConfig = {
  code: string; // short display text, e.g. "B" or "OMB"
  label: string; // full text for the tooltip, e.g. "Blunder" or "One Man Back"
  color?: string; // Tailwind text-color classes; border reuses it via border-current
};

// Severity is a closed set — Prisma's ErrorSeverity enum, lowercased — so
// it's typed as one: severityBadges must cover every key (a new enum value
// fails to compile until it's mapped), and SeverityBadge only accepts these.
export type SeverityKey = Lowercase<ErrorSeverity>;

export function severityKey(severity: ErrorSeverity): SeverityKey {
  // toLowerCase() is typed as plain string; the result is a SeverityKey by
  // construction.
  return severity.toLowerCase() as SeverityKey;
}

// Reuses MistakesSection.tsx's existing two-tone my-move/best-move palette
// exactly (red for blunder, amber for anything else) rather than inventing
// a third color for "doubtful" — DOUBTFUL already collapses into the amber
// "error" bucket everywhere else in this codebase (see
// lib/decisionFromRow.ts's severityFor), so it gets the same amber here,
// distinguished only by its "D" code.
export const severityBadges = {
  blunder: { code: "B", label: "Blunder", color: "text-red-600 dark:text-red-400" },
  error: { code: "E", label: "Error", color: "text-amber-600 dark:text-amber-400" },
  doubtful: { code: "D", label: "Doubtful", color: "text-amber-600 dark:text-amber-400" },
  none: { code: "-", label: "No mistake" },
} satisfies Record<SeverityKey, BadgeConfig>;

// Short 2-4 char codes for the compact badge itself — a Badge-display-only
// concern (collision-avoidance within a small visual footprint), not
// something lib/classificationLabels.ts's mapper needs to know about.
// Labels (the tooltip text) come from that mapper's raw-value map instead of
// being hand-maintained a second time here — see the comment above it for
// why (single source of truth; this map used to define its own "Opening
// Game" label for opening_game, which had drifted from the wording the
// mapper now uses, "Opening"). Keyed by the same 17 real raw classification
// values as CLASSIFICATION_LABELS_BY_RAW_VALUE below, since a badge is
// always given an actual row's raw classification.
const CLASSIFICATION_CODES: Record<string, string> = {
  "6_prime": "6PR",
  attacking_game: "AG",
  blitz: "BLZ",
  close_out: "CO",
  crunching_game: "CG",
  deep_anchor_game: "DAG",
  early_backgame: "EBG",
  early_blitz: "EBZ",
  end_game_contact: "EGC",
  holding_game: "HG",
  late_backgame: "LBG",
  late_game_hit: "LGH",
  middle_game: "MG",
  mutual_holding_game: "MHG",
  one_man_back: "OMB",
  opening_game: "OG",
  race: "RACE",
};

// Deliberately no per-value color: classification badges are for quick
// text identification only, not a signal competing with severity's color
// coding, so `color` is left unset (Badge's neutral default) for every
// entry here.
//
// Keyed by plain string on purpose, unlike severityBadges: classification
// is an open set (Galaxy's data, no enum), and every value reaching a badge
// is a DB string — a literal-keyed type could only be satisfied by a cast.
// Coverage of the 17 known values is enforced by lib/badges.test.ts instead.
export const classificationBadges: Record<string, BadgeConfig> = Object.fromEntries(
  Object.entries(CLASSIFICATION_LABELS_BY_RAW_VALUE).map(([value, label]) => [
    value,
    { code: CLASSIFICATION_CODES[value] ?? value, label },
  ])
);

// Lookups for SeverityBadge/ClassificationBadge. Both fall back to the raw
// value as code and label rather than returning undefined (which Badge
// would throw on): for classification because Galaxy can add values this
// code doesn't know yet; for severity only as a backstop, since the type
// already restricts it to mapped keys — it can only miss via a cast or
// untyped data. Own-property lookup, so a value like "toString" can't
// resolve to an inherited Object.prototype member instead of falling back.
function lookupBadge(map: Record<string, BadgeConfig>, value: string): BadgeConfig {
  return Object.hasOwn(map, value) ? map[value] : { code: value, label: value };
}

export function badgeForSeverity(key: SeverityKey): BadgeConfig {
  return lookupBadge(severityBadges, key);
}

export function badgeForClassification(value: string): BadgeConfig {
  return lookupBadge(classificationBadges, value);
}
