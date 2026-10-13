@AGENTS.md

## Claude Code only

This section applies to Claude Code only. omp reads this file too and should skip it.

- Agents live in `.claude/agents/`, generated from `agents/roles/` by `npm run agents:sync`. Each one's guard hook is in `.claude/hooks/`, wired in its frontmatter; the visual-reviewer has no hook, since it has no Bash, Write or Edit.
- A SessionStart hook (`.claude/hooks/omp-queue-check.mjs`, wired in `.claude/settings.json`) lists omp's "Done by omp (to check)" entries that master hasn't checked yet. When it prints something, tell the user in your first reply and offer to review.
- When a batch is done, run `/wrap-up`, which rewrites `docs/current-state.md`, then tell the user it's a good point to `/clear`.
- Also suggest `/wrap-up` then `/clear` before starting work when the user brings up a new, unrelated batch in a session that already finished one. Suggest it too when a single batch has run long (many agent round-trips or large file dumps). Say it in one line and let the user decide. Don't block on it.
- `.claude/settings.json` sets `autoCompactWindow` to 350k as a safety net, not as the plan. It also denies `git push` and denies reading or editing `.env*` (`.env.example` excepted). A Bash command can still write to `.env`, so the rule in AGENTS.md is what matters.
