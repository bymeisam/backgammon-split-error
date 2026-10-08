import type { ErrorSeverity } from "@/lib/generated/prisma/enums";
import type { Severity } from "@/lib/mistakes";
import { CLASSIFICATION_LABELS_BY_RAW_VALUE } from "@/lib/classificationLabels";
import { style as shared } from "@/lib/styles/shared.styles";

// What app/components/ui/Badge.tsx renders. Lives here, with the config
// maps built from it, rather than in the component file — lib/ shouldn't
// import from app/.
export type BadgeConfig = {
  code: string; // short display text, e.g. "B" or "OMB"
  label: string; // full text for the tooltip, e.g. "Blunder" or "One Man Back"
  // Tailwind color classes (text, and border/background when set); unset
  // means Badge's neutral outlined default.
  color?: string;
};

// Galaxy's four severity tiers, as its site names them. A closed set, one
// per Prisma ErrorSeverity value — severityBadges must cover every tier (a
// new one fails to compile until it's mapped), and SeverityBadge only
// accepts these. lib/mistakes.ts's Decision.severity is the same set minus
// "best" (null there).
export type SeverityTier = "best" | "good" | "error" | "blunder";

const TIER_BY_ERROR_SEVERITY = {
  NONE: "best",
  DOUBTFUL: "good",
  ERROR: "error",
  BLUNDER: "blunder",
} as const satisfies Record<ErrorSeverity, SeverityTier>;

export function severityTier(severity: ErrorSeverity): SeverityTier {
  return TIER_BY_ERROR_SEVERITY[severity];
}

// Galaxy's names: none "Best", doubtful "Good", error "Error", blunder
// "Blunder". In Galaxy's order, best first.
export const SEVERITY_TIER_LABELS = {
  best: "Best",
  good: "Good",
  error: "Error",
  blunder: "Blunder",
} as const satisfies Record<SeverityTier, string>;

// The tier a played move is coloured in (the move text in the lists, the
// my-move box under the board): blunder and good as themselves, anything
// else (an error, or no grade) as an error. Display only.
export function playedMoveTier(severity: Severity | null): SeverityTier {
  return severity === "blunder" ? "blunder" : severity === "good" ? "good" : "error";
}

// The severity name for a stored ErrorSeverity value — what the /mistakes
// and /repeated-positions severity filters and result lines show.
export function severityLabel(severity: ErrorSeverity): string {
  return SEVERITY_TIER_LABELS[severityTier(severity)];
}

// Full names on the badge itself (not one-letter codes: "Best" and
// "Blunder" would both be "B"), in Galaxy's colours — the one severity
// source, lib/styles/shared.styles.ts's severityChip.
export const severityBadges = {
  best: { code: "Best", label: "Best", color: shared.severityChip("best") },
  good: { code: "Good", label: "Good", color: shared.severityChip("good") },
  error: { code: "Error", label: "Error", color: shared.severityChip("error") },
  blunder: { code: "Blunder", label: "Blunder", color: shared.severityChip("blunder") },
} satisfies Record<SeverityTier, BadgeConfig>;

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

export function badgeForSeverity(tier: SeverityTier): BadgeConfig {
  return lookupBadge(severityBadges, tier);
}

export function badgeForClassification(value: string): BadgeConfig {
  return lookupBadge(classificationBadges, value);
}
