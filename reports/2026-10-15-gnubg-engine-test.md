# GNU Backgammon engine test — 2026-10-15

## Install and drive approach

Homebrew has no `gnubg` formula. The local arm64 Docker engine works. Build the separate GPL-licensed executable image once:

```sh
docker build -t omp-gnubg:1.07.001 engine/gnubg
```

`engine/gnubg/Dockerfile` uses `debian:bookworm-slim` and installs the Debian `gnubg` package. On this run it installed GNU Backgammon **1.07.001** (`/usr/games/gnubg`) and its required `gnubg-data` package. The package initialized the two-sided bear-off database. The wrapper invokes the executable only as a separate process with `docker run --rm -i omp-gnubg:1.07.001 /usr/games/gnubg -t -q`; no GNU Backgammon source is copied into this repository.

Commands go over stdin: `new game`, `set matchid <GNU Match ID>`, set the configured evaluation level, `set board <GNU Position ID>`, `set dice <high> <low>`, `hint`, then `quit`. A single process handles all 21 unordered rolls for one position; starting one container per roll would waste startup time. The wrapper validates/parses the CLI's ranked `hint` output and expands GNU's repeated-move shorthand into the app's per-hop notation.

The current interface reports **0-ply**: GNU 1.07.001's `hint` output identifies each candidate as `Cubeful 0-ply`, including after setting the deeper analysis/evaluation options. The wrapper verifies that the reported level matches its single `EVALUATION_PLIES` setting instead of claiming a deeper analysis that the CLI did not produce. This is a fast baseline, not evidence about 2-ply quality.

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

The equity difference is GNU's played-candidate equity minus Galaxy's played-candidate equity; median is reported as the median absolute difference. GNU's played candidate was absent from its returned candidate list for one decision. “Also flagged” uses a fixed 0.08 equity-loss threshold against GNU's best candidate; this is a simple comparison rule, not GNU's official game-review severity classifier. It caught 0/16 Galaxy `ERROR` decisions and 8/14 `BLUNDER` decisions in this sample.

Examples of best-move disagreement:

- Decision **1276391**, opening 5–4: Galaxy best `24/20 6/1*`; GNU best `24/20 13/8`. GNU rated the played `24/20 13/8` at +0.089, Galaxy at +0.1708.
- Decision **1280577**, opening 4–3: Galaxy best `24/21 24/20`; GNU best `24/20 13/10`. The played move was `24/21 13/9`; GNU and Galaxy candidate equities were -0.005 and -0.0157 respectively.
- Decision **1276280**, opening 3–2: Galaxy best and played move `24/22 24/21`; GNU best `24/21 13/11`. GNU's played move loss was only 0.009, illustrating that a best-move disagreement is not necessarily a practical error.

The comparison is a small, deterministically shuffled sample of the latest 6,000 eligible decision rows, not a random sample over the full database. This and the 0-ply depth limit generalization. The 85% best-move match is promising enough to justify testing deeper analysis, but not enough to treat the engine as a replacement for Galaxy analysis.

## Recommendation

Prefer **local precomputation** for an initial real feature. The measured container-backed all-roll request took about 0.66 seconds; the full 200-decision harness took 87 seconds including query/sample preparation and one all-roll run. The 309 ms median engine invocation is suitable for paced offline work and avoids introducing an always-on Oracle-VM service, deployment, monitoring, and network failure mode. The Docker image is an evaluation prerequisite on the machine doing the work. Revisit a service only if repeated on-demand all-roll requests prove materially useful and local compute is unavailable. First compare 2-ply output using GNU's actual move-analysis path; the tested `hint` protocol did not provide it.

## Results-table proposal only

No schema change is requested. If repeated evaluation demonstrates a real storage need, a result record would need:

- GNU Position ID, stored with case-sensitive/binary collation (external identifier);
- match context that affects cubeful equity: cube value/owner, match length, both scores and Crawford state (not the current roll, because one cache entry should cover all 21 rolls);
- GNU version/build and evaluation level, so results from incompatible engines/settings never collide;
- the 21 roll results, each with ranked move notation, equity and available win/gammon/backgammon probabilities;
- a computed timestamp and a key/index covering position plus match context plus engine version/settings for lookup and invalidation.

A JSON result payload is adequate until SQL needs to filter or aggregate candidate moves; normalizing every candidate into rows now would add schema and maintenance cost without demonstrated query demand. Before adding any columns/table, show which schema rule it meets and request it via `docs/omp-queue.md`.

## Verification

- `npm test`: 72 files, 873 tests passed; `npx tsc --noEmit` and `npm run lint` passed.
- Live smoke: `analyze` returned ranked candidates and probabilities for a real local decision; `allRolls` returned 21 unique rolls in one Docker invocation. Fixture tests parse saved CLI output without Docker.
- Comparison and bear-off checks used only local `bg_db_ro`; no database writes, schema changes, or Oracle access.
