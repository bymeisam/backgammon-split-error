// The match list's PR columns ("Your PR", "Opp. PR"): Match.userError and
// Match.opponentError, the PR the match source reports for each player in
// its match list. Not computed by this app, and source-neutral on purpose:
// the data will come from other sources too. One hint text, shown on the
// dashboard, /matches and /galaxy/matches.
export const SOURCE_PR_HINT =
  "PR as reported by the match source. It includes resignations, so it can differ from the match page's PR.";
