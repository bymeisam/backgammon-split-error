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

### Don't add the same position twice
- **Idea:** the same position (`sourcePositionId`) can come up in several games. When adding cards, especially in bulk, skip a decision if another card already has the same position, or group them, so one lesson doesn't become several cards.
- **Why deferred:** the user isn't sure how often it happens (2026-10-08). Measure first, then decide how to handle it.

### Bulk add: worst mistakes first
- **Idea:** order "Add all to review" by error size, biggest first, instead of the list's newest-first order. The 100-card cap then picks the most valuable cards.
- **Source:** user, 2026-10-08 ("keep it in mind").

### Leech cards
- **Idea:** auto-tag a card "leech" once it's been failed many times (Anki's default threshold is 8 lapses; maybe lower here). The user can then filter leeches, write a better note, or suspend them. This is likely most useful for cube decisions.
- **Source:** user, 2026-10-08.

### Review stats from the log
- **Idea:** accuracy over time from `ReviewLog`, by phase, tag, and checker vs cube, to show whether weak areas are improving. It pairs with the rating-over-time chart.
- **Source:** user, 2026-10-08.

### Win, gammon and backgammon chance cards
- **Idea:** a second kind of review card. Show a position and ask you to estimate the win, gammon and backgammon chances, then reveal the engine's numbers. The point is to build your feel for these chances in different kinds of positions.
- **Notes:** the chances are already in each candidate's `probabilities` in `raw`. The planned normalized-analysis column on `Decision` will store them too (decided 2026-10-06).
- **Source:** user, 2026-10-06, during spaced-repetition planning.

### Counting and race drills
- **Idea:** train counting and race skills in three stages per skill:
  1. **Memorise:** spaced-repetition cards for fixed facts, such as match-equity values, take points, reference bear-off EPCs and race benchmarks.
  2. **Practise:** untimed, with the working shown.
  3. **Test:** timed rounds, like Galaxy's "PIP Rush" (type a number, 3 lives, accuracy and streak).
- **Drills the user picked:** pip count and difference (plus race %); EPC and wastage (exact, from a one-sided bear-off table built once and shipped as a static file); race cube by formula (Keith count and others, on the user's own race cube decisions, compared with the engine's verdict); shot counting; take points and the MET.
- **Positions:** from the user's own games and from generated positions. The answers are computed from the position, so no `Decision` columns are needed.
- **Storage:** probably one new table for drill attempts. Fact cards need either a second card kind or a small table of their own; decide that at design time.
- **Status:** approved as an idea only (user, 2026-10-08): "we need to think about it more".

### Review by making the move on the board
- **Idea:** in the spaced-repetition review, answer by actually moving the checkers on the board (free recall) instead of picking from a list of candidate moves. This is closer to real Anki recall and to over-the-board play.
- **Why deferred:** it needs an interactive board that takes move input, which is a big piece of UI work. The first version uses a multiple-choice list (decided 2026-10-06).
- **Notes:** the same interactive board would also serve [position search](#position-search-from-a-manual-board).

### Interactive forum checker explorer (phase 1, 2026-10-12)
Forum checker attachments with valid GNU Position and Match IDs now include a
client-only legal-move explorer. It supports direct clicks on a legal checker
source (choosing the largest currently usable die), pointer drag-and-drop from
a checker or bar source to a legal destination, bar entry, blocked points,
hits, doubles, dice ordering, maximum dice use, bearing off and oversized
bear-off, with ephemeral undo/reset state. Accessible destination buttons and
keyboard point targets remain available as fallbacks. Cube attachments remain
static. The pure checker engine is intentionally independent of React and
ForumPost so the same explorer can later be reused by review cards; engine
evaluation, best-move comparison, cube interaction, match scoring and spaced
repetition remain future phases.

### Position search from a manual board
- **Idea:** set up a position on screen, encode it to a GNU Position ID, and search your decisions for that exact position.
- **Notes:** other sources may use a different position-ID format, such as XG's, so this needs a common representation. Closely related to [notes on a position](#notes-on-a-position-not-just-a-decision).
- **Source:** user's idea list, 2026-10-06.

### Forum
- **Idea:** a position-centered discussion space for questions, explanations, and future review. The core loop is:
  1. See a position.
  2. Post a question or analysis.
  3. Discuss it.
  4. Resolve the discussion.
  5. Review the position later.
- **Current foundation:** forum posts attach immutable `StudyPosition` rows. A position can originate from the position builder or from a Galaxy match decision. Posts now support up to four ordered position attachments, including mixed manual and match-decision sources. The local owner-only forum vertical slice is implemented; public multi-user access remains future work.
- **Source:** user's product context and forum planning, 2026-10-12.

#### Recommended additions

##### Position discussion quality
- **Position provenance links:** link an attachment back to its originating match, game, replay decision, or builder context.
- **Structured position metadata:** show checker/cube type, dice, cube value and owner, score, match length, GNU Position ID, GNU Match ID, and source decision.
- **Multiple position attachments:** support before/after/candidate positions in one post. **Status:** implemented with up to four ordered manual or match-decision attachments.
- **Multiple candidate moves:** compare the played move, best move, and alternative ideas in one discussion.

##### Discovery and organization
- **Controlled tags:** begin with tags such as `checker-play`, `cube-decision`, `opening`, `bearoff`, `match-play`, and `question`.
- **Search and filters:** search title/body and filter by tag, position kind, source, and match ID.
- **Duplicate detection:** warn when the same GNU Position ID + GNU Match ID is already being discussed.

##### Discussion lifecycle
- **Post status:** support `Open`, `Resolved`, and `For review`.
- **Best answer:** mark one reply as the accepted explanation.
- **Edit history:** preserve changes to post bodies and attachments once discussions become valuable historical study records.
- **Add to review:** convert a forum position into a self-rated review card without duplicating the board representation.

##### Later community features
- **Notifications and following:** notify a user when a followed discussion receives a reply. Defer until there are multiple users.
- **Moderation and reporting:** add ownership, visibility, report, and moderation controls before opening the forum publicly.

#### Architectural direction
- Keep these concepts separate:
  - **Forum post:** user-authored discussion and explanation.
  - **Study position:** immutable board and match context.
  - **Review card:** scheduling state and learning workflow.
  - **Reply:** discussion response, optionally marked as the best answer.
- A post should reference a study position. A review card should reference the study position or post attachment, not duplicate the board representation.
- Preserve exact position and match identifiers so a forum discussion remains reproducible.

#### Suggested sequence
1. Position provenance and metadata.
2. Multiple position attachments.
3. Tags and search.
4. Self-rated “Add to review”.
5. Resolved/best-answer workflow.
6. Public-user authorization and moderation.
7. Notifications and other social features.

#### Defer for now
- Likes and upvotes.
- Reputation systems.
- Followers and social graphs beyond the later notification idea.
- Categories and subforums.
- Rich-text editing.
- Real-time updates.
- Generic social-post abstractions.
- Public moderation infrastructure before public access is actually approved.

## Decision notes

### Notes on a position, not just a decision
- **Idea:** when the same position comes up in another game, show any note you wrote on that position there too. This would key on a position identifier, such as `sourcePositionId` or a position hash, instead of a single `Decision` row.
- **Why deferred:** a note is about one specific decision in one specific game (decided 2026-10-06). Per-position notes would be a separate, optional layer on top.

### Review list of all notes
- **Idea:** a page or filter that lists every decision you've noted, with links back to the board, so you can review your notes in one place instead of finding them row by row.
- **Why deferred:** for now, notes appear wherever a decision is shown, plus a dot on list rows. Build this once there are enough notes to make browsing them worthwhile.

### Notes visible only to the match owner
- **Idea:** once the app has auth, show a note (pages and `/api/decision-notes`) only to the owner of the match it belongs to. The current Clerk wall protects the single approved app owner; per-match ownership is still not modeled.
- **Why deferred:** source data remains shared and the current deployment admits one owner. Per-user study ownership will require a separate data-model decision.

## Progress tracking

### Rating over time
- **Idea:** a chart of the user's Galaxy rating over time, built from each match's `Match.playedAt` and `Match.userRating`. Both are kept for this; they come from Galaxy's match list.
- **Source:** user, 2026-10-07, during the column audit.

## Deployment and auth

### Vercel deploy behind auth
- **Idea:** deploy to Vercel as a read-only viewer behind an auth wall that admits only you.
- **Status:** implemented with Clerk's invite-only sign-in, a local `AppUser` allowlist, and independent owner flags in Clerk private metadata and the local database. The app remains read-only unless `ENABLE_WRITE_MODE` and the regular write credential are deliberately enabled.
- **Follow-up:** configure the Vercel Clerk keys, create the `DATABASE_URL_AUTH` AppUser-only grant, apply the AppUser migration, and set both owner flags for the approved account.
- **Source:** user's idea list, 2026-10-06.

## Settings

### Settings page
- **Idea:** an in-app settings section for user-tunable values, starting with the review limits (new cards per day, reviews per day, batch size, number of options shown).
- **Why deferred:** for now these live as constants in one dedicated settings file, so a settings page can later read and write the same values in one place (decided 2026-10-06, during spaced-repetition planning).

## Sync

### Stop the match-list walk early
- **Problem (measured 2026-10-08):** every sync pages through Galaxy's whole match list (~4,300 matches) before syncing anything. That's about 80 s of fixed cost, even when nothing is new. On top of that, each new match costs about 6–7 s (`SyncRun` history).
- **Idea:** Galaxy's list is newest-first, so stop paging once sync reaches a match that's already stored. A daily incremental sync would then read a page or two, taking about 1–2 s. Local syncs get faster too.
- **Related:**
  - `/api/sync/incremental` caps a request at 20 matches. Its comment assumes Vercel Hobby's 10 s limit, but at about 6.5 s a match that's about 2 minutes.
  - Syncing from the live site would also need batching, and a login, since it writes to Oracle with the Galaxy token.

## Tooling

### Design review by another LLM
- **Idea:** have a separate agent critique the site's look and feel and suggest improvements.
- **Source:** user's idea list, 2026-10-06.

## Performance

### /mistakes list query is slow
- **Observed (2026-10-06, local):** filtering /mistakes to `middle_game` / CHECKER / BLUNDER took about 5.4s for the page query and 7.3s for its `COUNT(*)`, which matched 17,884 rows. It uses `Decision_kind_classification_idx` and a filesort over about 273k rows to `ORDER BY eventId DESC`.
- **Idea:** a composite index that covers the filter columns plus `eventId`, or replacing the exact count with a cheaper one.
- **Why deferred:** found while investigating decision notes. It's out of scope there, and it needs its own measurement on Oracle.

## Playing

### Play my Galaxy games on this site
- **Idea:** play live Backgammon Galaxy matches from inside this app instead of Galaxy's own site, with the app's notes, review and analysis next to the board.
- **Notes:** this would need Galaxy's game or play API. We only use its analysis endpoints today, and the play side isn't documented for third parties. Check Galaxy's terms before building anything, since automating play against their service may not be allowed. The client analysis in `galaxy-source/` would show how their play protocol works.
- **Source:** user, 2026-10-08.

### Own play platform: games against opponents, fully managed by this site (last, the biggest idea)
- **Idea:** play backgammon against other people on this website, with everything run here: matches, dice, the cube, scoring, and post-game analysis.
- **The pieces:**
  - **Game engine:** legal moves, bear-off, cube and Crawford rules, match scoring. We already have position and match-ID encoding (`lib/gnuMatchId.ts`, GNU Position ID decoding).
  - **Fair dice:** a server-side random number generator, with a verifiable log (e.g. commit-reveal) so neither player can doubt the dice.
  - **Real-time multiplayer:** websockets or a hosted real-time service, lobbies and invites, clocks, and handling disconnects.
  - **Accounts and auth:** a hard prerequisite (see "Vercel deploy behind auth").
  - **Analysis:** the hardest part. Run an engine server-side: GNU Backgammon is open source and has a scriptable/Python interface. Then feed the results through a new source translator into the same `Decision`/review pipeline, so games played here get notes, cards and stats like Galaxy games.
- **Why last:** it's a separate product in itself. It becomes realistic once auth, a second data source (the XG import idea) and the source-translator pattern are proven.
- **Source:** user, 2026-10-08 ("a big one, but possible I think").
