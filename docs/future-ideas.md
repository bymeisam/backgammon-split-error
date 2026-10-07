# Future ideas

Ideas parked for later review. These are not planned work. Each entry says where it came from and, if known, why it was deferred.

## To review later

### Cube UI review (user, 2026-10-07)
The user accepted the Galaxy-style cube display for now but wants to look at it again. Open points:
- **Offered cube on takes and passes:** it's drawn centred on the bar column at the receiver's edge, and can overlap a receiver checker on the bar.
- **Cube square value:** on a no-double check with a centred cube, the list's square shows "1".
- **No Roll column on /mistakes:** cube rows there have no cube square, because the list has no Roll column. Adding one would also show dice on checker rows.
- **Wording:** Galaxy's labels (No Double, Double, Too good, Take, Pass), with the opponent's half as grey secondary text.

## Data sources

### XG file import
- **Idea:** support XG match files (`.xgp`/`.xg`) as a second data source alongside the Galaxy API.
- **Notes:** imported rows need their own `source` value. Any string identifier taken from XG files must be pinned to `utf8mb4_bin` (CLAUDE.md). XG uses its own position-ID format, which ties in with [position search](#position-search-from-a-manual-board).
- **Source:** user's idea list, 2026-10-06.

### Single-match lookup by ID
- **Idea:** `sourceMatchId` is a global Galaxy counter, so any match can be fetched by its ID. This would be a targeted tool for one specific external match, such as a referenced tournament game.
- **Ruled out:** bulk-ingesting other players' matches.
- **Source:** user's idea list, 2026-10-06.

## Study and review

### Built-in spaced repetition
- **Idea:** an Anki-style review flow built on the pipeline's own decision and error data, instead of exporting through AnkiGammon. Your personal notes on each blunder show up at recall time.
- **Source:** user's idea list, 2026-10-06.

### Review-card ideas borrowed from Galaxy's training features
- **Question wording:** label each card's question the way RushGammon does: "Your Roll" (double?), "Opponent Doubled" (take?), "Your Move".
- **Result screen:** "Correct/Incorrect", "Played: X", "Best: Y", the equity gap, then the user's note.
- **Grading tiers:** use Galaxy's Best/Good/Error/Blunder tiers and colours. The planned 0.02 "counts as correct" threshold equals Galaxy's good/error boundary.
- **Session summary:** an Accuracy % and Streak readout at the end of each review session.
- **Card organisation:** group cards and mistakes by Galaxy's 17 position categories, plus "Recent", with counts.
- **Period summary:** Checker Play vs Cube Play, "Error N (eq)" / "Blunder N (eq)", total Equity Loss, Error Rate.
- **Source:** `reports/2026-10-07-galaxy-client-comparison.md` (Galaxy has no spaced repetition; its puzzles avoid repeats, the opposite of ours).

### Win, gammon and backgammon chance cards
- **Idea:** a second kind of review card. Show a position and ask you to estimate the win, gammon and backgammon chances, then reveal the engine's numbers. The point is to build your feel for these chances in different kinds of positions.
- **Notes:** the chances are already in each candidate's `probabilities` in `raw`. The planned normalized-analysis column on `Decision` will store them too (decided 2026-10-06).
- **Source:** user, 2026-10-06, during spaced-repetition planning.

### Review by making the move on the board
- **Idea:** in the spaced-repetition review, answer by actually moving the checkers on the board (free recall) instead of picking from a list of candidate moves. This is closer to real Anki recall and to over-the-board play.
- **Why deferred:** it needs an interactive board that takes move input, which is a big piece of UI work. The first version uses a multiple-choice list (decided 2026-10-06).
- **Notes:** the same interactive board would also serve [position search](#position-search-from-a-manual-board).

### Position search from a manual board
- **Idea:** set up a position on screen, encode it to a GNU Position ID, and search your decisions for that exact position.
- **Notes:** other sources may use a different position-ID format, such as XG's, so this needs a common representation. Closely related to [notes on a position](#notes-on-a-position-not-just-a-decision).
- **Source:** user's idea list, 2026-10-06.

### Forum
- **Idea:** discuss or chat about specific positions.
- **Notes:** needs auth and multiple users first (see [Vercel deploy](#vercel-deploy-behind-auth)).
- **Source:** user's idea list, 2026-10-06.

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

## Deployment and auth

### Vercel deploy behind auth
- **Idea:** deploy to Vercel as a read-only viewer first, with the Galaxy pages and routes hidden until the app sits behind an auth wall that admits only you.
- **Notes:** the first part already exists. The app is deployable as a read-only viewer (`app/status/notes.ts`, `docs/deploy.md`), and `/galaxy/*` plus the write routes return 404 unless `ENABLE_WRITE_MODE` is set (`proxy.ts`, `lib/galaxyGate.ts`). The open part is the auth wall. That same auth is what [owner-only notes](#notes-visible-only-to-the-match-owner) and the [forum](#forum) need.
- **Source:** user's idea list, 2026-10-06.

## Settings

### Settings page
- **Idea:** an in-app settings section for user-tunable values, starting with the review limits (new cards per day, reviews per day, batch size, number of options shown).
- **Why deferred:** for now these live as constants in one dedicated settings file, so a settings page can later read and write the same values in one place (decided 2026-10-06, during spaced-repetition planning).

## Tooling

### Design review by another LLM
- **Idea:** have a separate agent critique the site's look and feel and suggest improvements.
- **Source:** user's idea list, 2026-10-06.

## Performance

### /mistakes list query is slow
- **Observed (2026-10-06, local):** filtering /mistakes to `middle_game` / CHECKER / BLUNDER took about 5.4s for the page query and 7.3s for its `COUNT(*)`, which matched 17,884 rows. It uses `Decision_kind_classification_idx` and a filesort over about 273k rows to `ORDER BY eventId DESC`.
- **Idea:** a composite index that covers the filter columns plus `eventId`, or replacing the exact count with a cheaper one.
- **Why deferred:** found while investigating decision notes. It's out of scope there, and it needs its own measurement on Oracle.
