# GNU Backgammon engine test — 2026-10-15

## Install and drive approach

Homebrew has no `gnubg` formula. The local arm64 Docker engine works. Build the separate GPL-licensed executable image once:

```sh
docker build -t bg-gnubg:1.07.001 engine/gnubg
```

`engine/gnubg/Dockerfile` uses `debian:bookworm-slim` and installs the Debian `gnubg` package. The package installs GNU Backgammon **1.07.001** at `/usr/games/gnubg` and its required `gnubg-data` bear-off databases. The wrapper invokes `/usr/games/gnubg -t -q` in `docker run --rm -i bg-gnubg:1.07.001`; five `quit`-only runs measured container/process startup separately from position evaluation.

`analyze(positionId, matchId, roll?)` uses the Match ID's roll by default or accepts an explicit pair; `allRolls(positionId, matchId)` submits all 21 unordered rolls in one process. Commands go over stdin: `new game`, `set matchid <GNU Match ID>`, set evaluation to 2-ply, then for each roll `set board <GNU Position ID>`, `set dice <high> <low>`, `hint`, and finally `quit`. Candidate depth is retained per move because GNU Backgammon can return 2-ply top candidates alongside 0-ply pruned candidates. The best candidate must match the configured 2-ply depth.

GNU Backgammon can return mixed depths under the configured 2-ply setting: this live fixture has ranks 1–8 at 2-ply and ranks 9–10 pruned at 0-ply. The parser preserves each candidate's own depth and rejects only when rank 1 is not 2-ply.

**Bear-off data is required for accurate bear-off evaluation.** With the default package data on an actual bear-off position, GNU assigned the forced `5/off 1/off` move equity +1.000 and 100% win probability. Re-running the same position with `-b` (disable bear-off database) changed the alternative `5/off` equity from -1.000 to -0.950 and the win probability from 0% to 2.5%. Keep `gnubg-data` in the image.

## Galaxy comparison

Read-only local `app_dev`, through `DATABASE_URL_READONLY` using `bg_db_ro`. The harness refuses non-local hosts or a different read-only user. It selected 200 analyzed Galaxy `CHECKER` decisions from 6,000 eligible rows in the `opening_game`, `middle_game`, and `race` classifications. Composition: 55 opening, 75 middle-game, 70 bear-off (bear-off classified by at least 10 checkers borne off across both sides). The sample included 16 Galaxy `ERROR` and 14 `BLUNDER` decisions. Galaxy candidates were read exclusively through `getDecisionAnalysis({ source: "galaxy", raw })`.

| Measure | Result |
|---|---:|
| GNU best move matched Galaxy best | 170/200 (85%) |
| Absolute played-move equity difference, median | 0.0035 (199 comparable decisions) |
| Galaxy errors/blunders in sample | 30 |
| Also flagged by GNU at loss ≥ 0.08 | 8/30 (26.7%) |
| Median time per position | 309 ms |
| All 21 rolls, one Docker process | 661 ms |
An independent second run reproduced the sample composition and quality metrics exactly; timing varied as expected between runs (323 ms median per position and 646 ms for all rolls). The table gives the first run's observed timings, not a fixed performance guarantee.

The equity difference is GNU's played-candidate equity minus Galaxy's played-candidate equity; median is reported as the median absolute difference. GNU's played candidate was absent from its returned candidate list for one decision. “Also flagged” uses a fixed 0.08 equity-loss threshold against GNU's best candidate; this is a simple comparison rule, not GNU's official game-review severity classifier. It caught 0/16 Galaxy `ERROR` decisions and 8/14 `BLUNDER` decisions in this sample.

Examples of best-move disagreement:

- Decision **1276391**, opening 5–4: Galaxy best `24/20 6/1*`; GNU best `24/20 13/8`. GNU rated the played `24/20 13/8` at +0.089, Galaxy at +0.1708.
- Decision **1280577**, opening 4–3: Galaxy best `24/21 24/20`; GNU best `24/20 13/10`. The played move was `24/21 13/9`; GNU and Galaxy candidate equities were -0.005 and -0.0157 respectively.
- Decision **1276280**, opening 3–2: Galaxy best and played move `24/22 24/21`; GNU best `24/21 13/11`. GNU's played move loss was only 0.009, illustrating that a best-move disagreement is not necessarily a practical error.

This was a small, deterministically shuffled sample of the latest 6,000 eligible decision rows, not a random sample over the full database. Those initial results were at 0-ply; the follow-up below reruns the same sample at the configured 2-ply level and records cases where GNU itself returns a shallower best candidate.

## Recommendation

The 2-ply sample agreement is 89.4% on the 170 positions GNU actually returned at 2-ply, but the strict analyzer rejected 30/200 positions whose best candidate remained 0-ply. The 21-roll invocation also produced at least one 0-ply best candidate and therefore no usable batch result. Keep this as an offline comparison only; do not treat it as a Galaxy replacement or build a stored-result feature yet. Resolve the engine's 0-ply top-candidate cases before relying on complete 2-ply coverage. Docker startup is about 284 ms of the measured single-position 366 ms, while the 21-roll invocation amortizes that startup but fails the depth contract.

## Results-table proposal only

No schema change is requested. If repeated evaluation demonstrates a real storage need, a result record would need:

- GNU Position ID, stored with case-sensitive/binary collation (external identifier);
- match context that affects cubeful equity: cube value/owner, match length, both scores and Crawford state (not the current roll, because one cache entry should cover all 21 rolls);
- GNU version/build and evaluation level, so results from incompatible engines/settings never collide;
- the 21 roll results, each with ranked move notation, equity and available win/gammon/backgammon probabilities;
- a computed timestamp and a key/index covering position plus match context plus engine version/settings for lookup and invalidation.

A JSON result payload is adequate until SQL needs to filter or aggregate candidate moves; normalizing every candidate into rows now would add schema and maintenance cost without demonstrated query demand. Before adding any columns/table, show which schema rule it meets and request it via `docs/omp-queue.md`.

## Verification

- `npm test`: 72 files, 874 tests passed; `npx tsc --noEmit` and `npm run lint` passed.
- Live smoke: `analyze` returned ranked candidates and probabilities for a real local decision; `allRolls` returned 21 unique rolls in one Docker invocation. Fixture tests parse saved CLI output without Docker.
- Comparison and bear-off checks used only local `bg_db_ro`; no database writes, schema changes, or Oracle access.
## 2-ply follow-up

Local counted Galaxy CHECKER rows were queried read-only using `rawError IS NOT NULL`: `NONE` 347,377 rows (0 to +0.068), DOUBTFUL 69,836 (-0.0200 to -0.0001), ERROR 67,593 (-0.0798 to -0.0200), BLUNDER 39,731 (-2.2008 to -0.0799). Galaxy loss is `max(0, -rawError)`, so positive `NONE` values do not count as losses. The sample comparison uses absolute loss bands: doubtful through `0.02`, error above `0.02` and below `0.0799`, blunder at or above `0.0799`.

2-ply comparison, local Galaxy error-band comparison, and speed:

The strict wrapper returns results only when rank 1 is at 2-ply; the benchmark still attempted the full deterministic sample and separately records positions where GNU's top candidate was 0-ply. Agreement and loss comparisons use only positions that passed that depth check.

| Measure | Result |
|---|---|
| 2-ply positions with rank 1 at configured depth | 170/200; 30 top candidates were 0-ply and rejected |
| GNU/Galaxy best-move agreement | 152/170 (89.4%) |
| Median absolute played-equity difference vs Galaxy | 0.0035 (169 comparable positions) |
| Median absolute difference between GNU loss and Galaxy loss (`max(0,-rawError)`) | 0 |
| Galaxy ERROR: GNU same / lower / none | 13 / 2 / 1 of 16 |
| Galaxy BLUNDER: GNU same / lower / none | 12 / 1 / 1 of 14 |
| Galaxy NONE/DOUBTFUL false alarms (GNU ERROR/BLUNDER) | 7/140 |
| Empty `quit`-only Docker run (median of 5) | 284 ms |
| Single position (Docker total / estimated engine work) | 366 / 82 ms |
| All 21 rolls (Docker total / estimated engine work) | 642 / 358 ms; output rejected because rank 1 was 0-ply for at least one roll |

The 170-position statistics exclude all 30 depth mismatches; one additional position lacked GNU's played move in its ranked list. The 21-roll measurement is wall time for the full Docker invocation, but strict parsing correctly returns no batch result when a roll's best candidate is 0-ply. Timing subtracts the median empty-run startup (284 ms) as an estimate of engine work.
