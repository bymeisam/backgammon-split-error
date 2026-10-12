@AGENTS.md

## Claude Code only

This section applies to Claude Code only. omp reads this file too and should skip it.

- Agents live in `.claude/agents/`, generated from `agents/roles/` by `npm run agents:sync`. Each one's guard hook is in `.claude/hooks/`, wired in its frontmatter.
- When a batch is done, run `/wrap-up`, which rewrites `docs/current-state.md`, then tell the user it's a good point to `/clear`.
- `.claude/settings.json` sets `autoCompactWindow` to 350k as a safety net, not as the plan. It also denies `git push` and denies reading or editing `.env*` (`.env.example` excepted). A Bash command can still write to `.env`, so the rule in AGENTS.md is what matters.
