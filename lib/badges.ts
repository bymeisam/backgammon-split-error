import type { BadgeConfig } from "@/app/components/ui/Badge";

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

// All 17 real classification values (confirmed live via /mistakes's
// MistakeStat-sourced filter dropdown — see app/mistakes/page.tsx's
// getFilterOptions). Deliberately no per-value color: classification badges
// are for quick text identification only, not a signal competing with
// severity's color coding, so `color` is left unset (Badge's neutral
// default) for every entry here.
export const classificationBadges: Record<string, BadgeConfig> = {
  "6_prime": { code: "6PR", label: "6-Prime" },
  attacking_game: { code: "AG", label: "Attacking Game" },
  blitz: { code: "BLZ", label: "Blitz" },
  close_out: { code: "CO", label: "Close Out" },
  crunching_game: { code: "CG", label: "Crunching Game" },
  deep_anchor_game: { code: "DAG", label: "Deep Anchor Game" },
  early_backgame: { code: "EBG", label: "Early Backgame" },
  early_blitz: { code: "EBZ", label: "Early Blitz" },
  end_game_contact: { code: "EGC", label: "End Game Contact" },
  holding_game: { code: "HG", label: "Holding Game" },
  late_backgame: { code: "LBG", label: "Late Backgame" },
  late_game_hit: { code: "LGH", label: "Late Game Hit" },
  middle_game: { code: "MG", label: "Middle Game" },
  mutual_holding_game: { code: "MHG", label: "Mutual Holding Game" },
  one_man_back: { code: "OMB", label: "One Man Back" },
  opening_game: { code: "OG", label: "Opening Game" },
  race: { code: "RACE", label: "Race" },
};
