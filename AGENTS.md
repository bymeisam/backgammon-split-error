<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Assistant restrictions

These repository rules apply to the main coding assistant:

- Read `CLAUDE.md` and `PROGRESS.md` before meaningful work. Discuss ideas before implementing them; implement only an explicit request or approved plan.
- Treat `.claude/agents/investigator.md`, `.claude/agents/developer.md`, and `.claude/agents/designer.md` as role definitions. The investigator is read-only; the developer implements an approved, self-contained spec; the designer proposes UI changes and writes only design reports or mockups.
- Never read, edit, copy, print, or switch any `.env*` file; `.env.example` is the only exception.
- Never push to a remote. Never change Oracle, use admin credentials, or run Oracle migrations, backfills, or writes without the user's explicit approval for that specific operation. Read-only queries must use the repository's read-only path.
- Treat `raw` payloads as immutable. New externally sourced string identifier columns require `COLLATE utf8mb4_bin` in migration SQL, with a comment explaining why. New columns must earn their place through a real query, cross-row computation, or view requirement.
- Keep styles in adjacent `[name].styles.ts` files; do not add inline Tailwind literals to JSX. Follow the `styling-conventions` skill.
- Do not attach user-authored data to live Galaxy views. Update `app/status/notes.ts` after stack, database, auth, or architecture changes.
- For a new page or visible component kind, require the screenshot-and-designer review workflow before considering the work complete.
- Verify the changed behavior with the specific runtime scenario or checks that cover it. For meaningful work, append a dated entry to `PROGRESS.md`; update an existing entry for today instead of creating a duplicate heading.

### Tool-policy mapping

The Claude `PreToolUse` guards are represented here as behavioral tool policies:

- Use `read`, `grep`, and `glob` for repository inspection. Use `edit` for surgical changes and `write` only for new files or full-file creation; never use shell commands to mutate files.
- Path traversal via `..` is forbidden. `.env*` files are never read or changed; `.env.example` is the only exception.
- Investigator mode is strictly read-only: no `edit`, `write`, destructive shell command, state-changing Git command, package installation, schema/data command, direct database client, or arbitrary code execution. Database reads use only `scripts/ro-query.ts`; Galaxy reads use only `scripts/galaxy-get.ts`.
- Designer mode may write only under `design/` and `reports/`. It does not run servers, scripts, interpreters, package managers, database commands, Playwright, or local HTTP requests.
- Developer mode may edit implementation files only for an approved spec. It never pushes, never changes Oracle without explicit per-operation approval, and treats any database-capable command as blocked unless the repository establishes that every active database URL is local.
- Shell commands must not use file-modifying utilities, output redirection, ad-hoc interpreters, credential/environment dumps, non-GET requests, or process-management commands when a repository tool provides a safer path.
- These are fail-closed policies: when a command's safety or target cannot be established, stop rather than guessing or routing around the restriction.

### Runtime agent mapping

Claude's three repository agents map to this assistant's available delegation agents as follows:

- `investigator` → `scout`: read-only repository investigation and factual findings. Pass the question, relevant paths, and an explicit no-edits requirement in the task context.
- `developer` → `task`: implementation of a self-contained, explicitly approved spec. Pass the complete spec, affected files, invariants, and verification commands; do not ask it to widen scope.
- `designer` → `reviewer` for read-only UI/code review, or `task` with an explicit design-only mandate when it must write reports or mockups. Any writes are limited to `design/` and `reports/`.

The assistant is the orchestrator: it owns planning, user approval, agent selection, complete handoffs, integration, and final verification. Delegated agents do not spawn further agents. These mappings are instructions for this runtime; `.claude/agents/*.md` remains the Claude Code configuration.
