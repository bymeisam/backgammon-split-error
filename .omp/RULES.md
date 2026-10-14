# omp only

These notes apply to omp only. The shared rules are in AGENTS.md. CLAUDE.md's "Claude Code only" section doesn't apply here.

- Model roles live in `.omp/config.yml` (`modelRoles`). Agent frontmatter refers to them as `model: "@<role>"`.
- Agents in `.omp/agents/` are generated from `agents/roles/` by `npm run agents:sync`. Edit the role sources (`body.md`, `omp.frontmatter.yml`, `omp.extra.md`), never the generated files.
- omp ignores `.claude/settings.json` and its guard hooks. Nothing blocks a push, a `.env*` read or a database command for you: each agent's `tools:` list and written rules are the only limits. When a command's safety or target can't be established, stop rather than guess or route around it.

## Runtime agent mapping

The repo's roles are omp agents of the same name in `.omp/agents/`:
- `investigator`: read-only investigation and factual findings. Pass the question and the relevant paths.
- `developer`: implements a self-contained, explicitly approved spec. Pass the complete spec, the affected files, the invariants and the verification commands. Don't ask it to widen scope.
- `designer`: design direction, the design system, new pages and new kinds of component, and mockups. Writes only under `design/` and `reports/`.
- `architect`: read-only architecture advice, on demand.
- `visual-reviewer`: read-only screenshot QA after a visible UI change. Pass the screenshot folder and the changed files. It returns its report and writes no files.

Use only these five roles for repo work. omp's built-in agents (`task`, `sonic`, and any other that can edit files) carry none of the repo rules, including "never touch `prisma/`" on `omp/main`, so never use them for edits. The read-only built-ins (`scout`, `reviewer`, `security-reviewer`) are fine for looking around and reviewing.

**Commit every finished queue task on `omp/main`.** The developer commits as part of its job (`agents/roles/developer/body.md`), so a handoff to it must not say "commit not requested". A queue task counts as done only once it's committed and its "Done by omp (to check)" entry gives the commit hash: master reviews and merges commits, never a working tree. This is the standing approval to commit locally on `omp/main`. Nobody pushes.

The main session is the orchestrator: it owns planning, user approval, agent choice, complete handoffs, integration and final verification. Delegated agents don't spawn further agents.
