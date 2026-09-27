// Single source of truth translating Decision.classification's 17 real raw
// DB values (Galaxy's own game-phase taxonomy — snake_case, no enum exists
// for it anywhere in this schema, see lib/badges.ts's own comment on the
// same point) into human-readable labels for dropdowns/badges/displayed
// text. Nothing else in this codebase should hand-write a
// classification -> label mapping of its own — see lib/badges.ts's
// classificationBadges, which now derives its labels from here instead of
// maintaining a second, potentially-drifting copy.
//
// The 17 values themselves aren't guessed — confirmed live earlier this
// session via /mistakes's MistakeStat-sourced filter dropdown (see
// PROGRESS.md's 2026-09-24 badge entries), the same list lib/badges.ts's
// classificationBadges already uses.
export interface ClassificationOption {
  // Unique key this option is selected/queried by — a dropdown's `value`
  // attribute and the corresponding URL query param value. For every
  // option below this is identical to `classification` (a plain 1:1
  // mapping onto a real Decision.classification value), but doesn't have
  // to stay that way: a future option representing a SUBSET of one
  // classification (e.g. splitting opening_game into "Opening (first
  // move)" vs "Opening (response)" — a later task, not this one) would
  // get its own distinct value here while still pointing at the same
  // classification underneath via the field below.
  value: string;
  // Human-readable label for dropdowns, badge tooltips, and any other
  // displayed text.
  label: string;
  // The real Decision.classification value this option filters on.
  classification: string;
  // Extra Prisma `where` conditions beyond matching `classification`, for
  // an option that represents a subset of one classification rather than
  // the whole thing. Unused by every option below — all 17 are plain 1:1
  // mappings today — this field exists so a future option (e.g. "Opening
  // (response)") can add whatever extra condition it needs without a
  // second, parallel lookup structure being invented for it later.
  extraFilter?: Record<string, unknown>;
}

export const CLASSIFICATION_OPTIONS: ClassificationOption[] = [
  { value: "6_prime", label: "6-Prime", classification: "6_prime" },
  { value: "attacking_game", label: "Attacking Game", classification: "attacking_game" },
  { value: "blitz", label: "Blitz", classification: "blitz" },
  { value: "close_out", label: "Close Out", classification: "close_out" },
  { value: "crunching_game", label: "Crunching Game", classification: "crunching_game" },
  { value: "deep_anchor_game", label: "Deep Anchor Game", classification: "deep_anchor_game" },
  { value: "early_backgame", label: "Early Backgame", classification: "early_backgame" },
  { value: "early_blitz", label: "Early Blitz", classification: "early_blitz" },
  { value: "end_game_contact", label: "End Game Contact", classification: "end_game_contact" },
  { value: "holding_game", label: "Holding Game", classification: "holding_game" },
  { value: "late_backgame", label: "Late Backgame", classification: "late_backgame" },
  { value: "late_game_hit", label: "Late Game Hit", classification: "late_game_hit" },
  { value: "middle_game", label: "Middle Game", classification: "middle_game" },
  { value: "mutual_holding_game", label: "Mutual Holding Game", classification: "mutual_holding_game" },
  { value: "one_man_back", label: "One Man Back", classification: "one_man_back" },
  // "Opening", not "Opening Game" (which this used to say, back when it
  // lived only in lib/badges.ts) — deliberately shorter, anticipating the
  // upcoming opening_game split into "Opening (first move)"/"Opening
  // (response)" options, where bare "Opening" reads naturally as the
  // umbrella term for both.
  { value: "opening_game", label: "Opening", classification: "opening_game" },
  { value: "race", label: "Race", classification: "race" },
];

const BY_VALUE = new Map(CLASSIFICATION_OPTIONS.map((o) => [o.value, o]));

// Falls back to the raw value itself rather than throwing — classification
// values live in Galaxy's data, not this codebase, so a value outside the
// 17 mapped above is possible if Galaxy ever adds one (same defensive
// stance ClassificationBadge already takes for its own lookup).
export function getClassificationLabel(value: string): string {
  return BY_VALUE.get(value)?.label ?? value;
}

export function getClassificationOption(value: string): ClassificationOption | undefined {
  return BY_VALUE.get(value);
}
