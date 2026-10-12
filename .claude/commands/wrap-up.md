Close out the current batch of work so the next one can start in a fresh session. Review this session's changes (git status/diff, and what was actually built or fixed in this conversation), then:

1. **Update `PROGRESS.md`** at the project root.
   - If today's date (`## YYYY-MM-DD`) already has an entry, extend its "What changed" / "What's next" bullets rather than adding a new heading.
   - If there's no entry for today, append a new one in this format:
     ```md
     ## YYYY-MM-DD
     - What changed
     - What's next
     ```
   - Keep it to meaningful work (schema changes, working features, fixed bugs), not a line-by-line diff summary.
   - Don't read the whole file to do this. Its top lines and its last entry are enough.

2. **Rewrite `docs/current-state.md`** as a snapshot. Replace its contents; don't append to it. Keep it under about a page:
   - where the code is: branch, clean or not, pushed or not, last commit;
   - the open threads, and who each one is waiting on (user, designer, developer);
   - Oracle steps that are prepared but not run, if any (they always need the user's approval);
   - an "updated" date.
   Leave history out: that belongs in PROGRESS.md.

3. **Archive old entries** if any `PROGRESS.md` entry is more than about two weeks old. Move it word for word into `docs/progress-archive/` (one file per range, named by date) and change nothing in the moved text.

4. **Tell the user** it's a good point to `/clear`, and that the next session should start by reading `docs/current-state.md`.

Don't touch `CLAUDE.md`: it only ever holds standing instructions, never history.
