Review the current session's changes (git status/diff, and what was actually built or fixed in this conversation) and update `PROGRESS.md` at the project root:

- If today's date (`## YYYY-MM-DD`) already has an entry, extend its "What changed" / "What's next" bullets rather than adding a new heading.
- If there's no entry for today, append a new one in this format:
  ```md
  ## YYYY-MM-DD
  - What changed
  - What's next
  ```
- Keep it to meaningful work — schema changes, working features, fixed bugs — not a line-by-line diff summary.
- Do not touch CLAUDE.md; it only ever gets the pointer/standing instruction, never history.

This command is for explicitly closing out a session on demand, on top of the standing "after meaningful work" instruction in CLAUDE.md.
