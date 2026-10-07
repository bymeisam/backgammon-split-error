// Single source of truth translating Decision.classification's 17 real raw
// DB values (Galaxy's own game-phase taxonomy — snake_case, no enum exists
// for it anywhere in this schema, see lib/badges.ts's own comment on the
// same point) into human-readable labels for dropdowns/badges/displayed
// text. Nothing else in this codebase should hand-write a
// classification -> label mapping of its own — see lib/badges.ts's
// classificationBadges, which derives its labels from here instead of
// maintaining a second, potentially-drifting copy.
//
// The 17 real classification values aren't guessed — confirmed live
// earlier this session via /mistakes's MistakeStat-sourced filter dropdown
// (see PROGRESS.md's 2026-09-24 badge entries).
//
// Labels are Galaxy's own display names for the same keys (since
// 2026-10-07), from its web client's blunder-categories page
// (reports/2026-10-07-galaxy-client-comparison.md), and listed here in
// Galaxy's display order. Galaxy's client also accepts a few alternative
// spellings of these keys (e.g. "blitz_early", "six_prime"); none occur in
// our data, so they aren't mapped.
export const CLASSIFICATION_LABELS_BY_RAW_VALUE: Record<string, string> = {
  opening_game: "Opening game",
  middle_game: "Middle game",
  race: "Race",
  early_blitz: "Blitz, early",
  blitz: "Blitz, middle and late",
  attacking_game: "Attacking game",
  mutual_holding_game: "Mutual holding game",
  one_man_back: "One man back",
  holding_game: "Holding game",
  deep_anchor_game: "Deep anchor game",
  end_game_contact: "Endgame contact",
  crunching_game: "Crunching game",
  "6_prime": "6 prime",
  early_backgame: "Backgame, early",
  late_backgame: "Backgame, late",
  late_game_hit: "Late game hit",
  close_out: "Close out",
};

// Galaxy's display order, by key (the order of the map above).
const GALAXY_ORDER = Object.keys(CLASSIFICATION_LABELS_BY_RAW_VALUE);

// Falls back to the raw value itself rather than throwing — classification
// values live in Galaxy's data, not this codebase, so a value outside the
// 17 mapped above is possible if Galaxy ever adds one (same defensive
// stance ClassificationBadge already takes for its own lookup). Own-property
// lookup, so a value like "toString" (reachable from a URL via getPhaseLabel)
// can't resolve to an inherited Object.prototype member.
export function getClassificationLabel(value: string): string {
  return Object.hasOwn(CLASSIFICATION_LABELS_BY_RAW_VALUE, value)
    ? CLASSIFICATION_LABELS_BY_RAW_VALUE[value]
    : value;
}

// "Phase" dropdown: the single merged filter /mistakes and /repeated-positions
// use in place of what used to be two separate dropdowns (Classification and
// Ply). Each option carries its own where-fragment — either a plain
// classification match or a plyNumber match — so both pages can spread
// resolvePhaseWhere()'s result directly into their existing `where` object
// alongside severity/category, with no other special-casing needed. This
// intentionally allows overlap between options (e.g. "2nd roll" (ply 3) is a
// subset of whatever classification that decision happens to carry, usually
// middle_game) — that's expected, not a bug to dedupe away.
//
// The four ply options assume the mover alternates strictly across a game's
// first 4 plies (ply 1/3 = one player's own two turns, ply 2/4 = the other
// player's responses to each). Checked directly against real data before
// shipping this: true for 14,928 of 15,351 games with ply data (97.2%) — the
// 423 exceptions (2.8%) are real, not a bug in plyNumber itself, most likely
// caused by a forced-pass/dance turn consuming what would otherwise be the
// other player's ply slot (most violations land on the ply2->ply3 or
// ply3->ply4 boundary specifically, consistent with a skipped turn shifting
// everything after it by one player). The "response" wording is therefore a
// convenience label that's very reliable but not a hard guarantee — plyNumber
// itself (an objective ordinal count) is unaffected either way.
export interface PhaseOption {
  value: string;
  label: string;
  where: { classification: string } | { plyNumber: number };
}

const FIXED_PHASE_OPTIONS: PhaseOption[] = [
  { value: "opening_game", label: "Opening (both plies)", where: { classification: "opening_game" } },
  { value: "ply_1", label: "1st roll", where: { plyNumber: 1 } },
  { value: "ply_2", label: "1st roll – response", where: { plyNumber: 2 } },
  { value: "ply_3", label: "2nd roll", where: { plyNumber: 3 } },
  { value: "ply_4", label: "2nd roll – response", where: { plyNumber: 4 } },
];

const FIXED_PHASE_BY_VALUE = new Map(FIXED_PHASE_OPTIONS.map((o) => [o.value, o]));

// Builds the full Phase dropdown: the 5 fixed options above (our own
// buckets, which keep their own labels), followed by every OTHER
// classification actually present (opening_game excluded — it's already
// covered by "Opening (both plies)") — sourced dynamically from whatever the
// caller passes (a live distinct-values query against MistakeStat/
// RepeatedPosition), not a hardcoded list, so a classification Galaxy adds
// in the future shows up automatically without a code change. Known keys
// come in Galaxy's display order; unknown ones after them, alphabetically.
export function phaseOptionsFor(rawClassifications: string[]): PhaseOption[] {
  const rank = (c: string) => {
    const i = GALAXY_ORDER.indexOf(c);
    return i === -1 ? GALAXY_ORDER.length : i;
  };
  const remaining = rawClassifications
    .filter((c) => c !== "opening_game")
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((c) => ({ value: c, label: getClassificationLabel(c), where: { classification: c } }));
  return [...FIXED_PHASE_OPTIONS, ...remaining];
}

// Resolves a Phase dropdown's selected value (or a raw classification value
// from an old-style ?classification= link — see the two pages' own comments
// on the alias) into a where-fragment. Doesn't need the dynamic
// classification list at all: anything that isn't one of the 5 fixed values
// is treated as a raw classification value directly, exactly how the
// classification param already worked before this merge — no validation
// against a known set, since classification is a free-form string handled
// at the DB layer either way.
export function resolvePhaseWhere(value: string): { classification: string } | { plyNumber: number } {
  return FIXED_PHASE_BY_VALUE.get(value)?.where ?? { classification: value };
}

// Label for a resolved Phase value — same dual lookup as getClassificationLabel
// (fixed option first, then a raw classification value, then the raw value
// itself as a last resort).
export function getPhaseLabel(value: string): string {
  return FIXED_PHASE_BY_VALUE.get(value)?.label ?? getClassificationLabel(value);
}
