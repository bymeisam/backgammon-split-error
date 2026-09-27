import type { BadgeConfig } from "@/app/components/ui/Badge";
import { CLASSIFICATION_OPTIONS } from "@/lib/classificationLabels";

// Reuses MistakesSection.tsx's existing two-tone my-move/best-move palette
// exactly (red for blunder, amber for anything else) rather than inventing
// a third color for "doubtful" — DOUBTFUL already collapses into the amber
// "error" bucket everywhere else in this codebase (see
// lib/decisionFromRow.ts's severityFor), so it gets the same amber here,
// distinguished only by its "D" code.
export const severityBadges: Record<string, BadgeConfig> = {
  blunder: { code: "B", label: "Blunder", color: "text-red-600 dark:text-red-400" },
  error: { code: "E", label: "Error", color: "text-amber-600 dark:text-amber-400" },
  doubtful: { code: "D", label: "Doubtful", color: "text-amber-600 dark:text-amber-400" },
  none: { code: "-", label: "No mistake" },
};

// Short 2-4 char codes for the compact badge itself — a Badge-display-only
// concern (collision-avoidance within a small visual footprint), not
// something lib/classificationLabels.ts's mapper needs to know about.
// Labels (the tooltip text) come from that mapper instead of being
// hand-maintained a second time here — see the comment above it for why
// (single source of truth; this map used to define its own "Opening Game"
// label for opening_game, which had drifted from the wording the mapper
// now uses, "Opening").
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
export const classificationBadges: Record<string, BadgeConfig> = Object.fromEntries(
  CLASSIFICATION_OPTIONS.map(({ value, label }) => [
    value,
    { code: CLASSIFICATION_CODES[value] ?? value, label },
  ])
);
