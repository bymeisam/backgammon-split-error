# Future ideas

Ideas parked for later review. These are not planned work. Each entry says where it came from and why it was deferred.

## Decision notes

### Notes on a position, not just a decision
- **Idea:** when the same position comes up in another game, show any note you wrote on that position there too. This would key on a position identifier, such as `sourcePositionId` or a position hash, instead of a single `Decision` row.
- **Why deferred:** a note is about one specific decision in one specific game (decided 2026-10-06). Per-position notes would be a separate, optional layer on top.

### Review list of all notes
- **Idea:** a page or filter that lists every decision you've noted, with links back to the board, so you can review your notes in one place instead of finding them row by row.
- **Why deferred:** for now, notes appear wherever a decision is shown, plus a dot on list rows. Build this once there are enough notes to make browsing them worthwhile.

### Notes visible only to the match owner
- **Idea:** once the app has auth, show a note (pages and `/api/decision-notes`) only to the owner of the match it belongs to. Today, notes on Oracle are readable by anyone on the public read-only site.
- **Why deferred:** there's no auth yet. The user accepted public notes for now (2026-10-06).

## Performance

### /mistakes list query is slow
- **Observed (2026-10-06, local):** filtering /mistakes to `middle_game` / CHECKER / BLUNDER took about 5.4s for the page query and 7.3s for its `COUNT(*)`, which matched 17,884 rows. It uses `Decision_kind_classification_idx` and a filesort over about 273k rows to `ORDER BY eventId DESC`.
- **Idea:** a composite index that covers the filter columns plus `eventId`, or replacing the exact count with a cheaper one.
- **Why deferred:** found while investigating decision notes. It's out of scope there, and it needs its own measurement on Oracle.
