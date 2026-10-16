# GNU Backgammon engine test — 2-ply follow-up

## Setup and method

The local arm64 image is `bg-gnubg:1.07.001`, built from `engine/gnubg/Dockerfile` (Debian Bookworm, `gnubg` plus `gnubg-data`). The harness is `npx tsx scripts/engine/gnubg-evaluation.ts`. It reads only local `app_dev` through `prismaReadOnly` and `localDbUrl("ro")`, checks localhost and `bg_db_ro`, and makes no writes or Galaxy calls. It takes the same stratified 200 rows (55 opening, 75 middle game, 70 bear-off) from 6,000 eligible rows, with the deterministic seeded shuffle.

GNU returns per-candidate depth. The parser continues to require rank 1 at 2-ply; it does not accept a 0-ply rank-1 result. On all observed rejections the returned candidate list had at least two moves, and GNU labelled each candidate `0-ply cubeful prune [expert]`. This is not evidence of a forced move, a single-candidate result, or an exact bear-off database answer. In particular, no GNU hint explicitly identifies a bear-off database answer. Therefore all 35 cases remain `other/unexplained`; none is admitted as exact/harmless.

## Current 2-ply rerun

| Measure | Result |
|---|---:|
| Attempted / rank-1 at configured 2-ply / rejected | 200 / 165 / 35 |
| Best-move agreement among analyzed positions | 148/165 (89.7%) |
| Median absolute played-equity difference | 0.0051 (165 measured) |
| Empty Docker run median (5 runs) | 254.8 ms |
| Single-position total / estimated engine work (median) | 353.8 / 99.0 ms |
| All 21 rolls total / estimated engine work | 949.0 / 694.2 ms; batch rejected |

The same query/sampler logic as the old harness at `1809cce` is present; the URL lookup is the expected change to `localDbUrl("ro")`. This run yielded 165/200 rather than the historical report's 170/200. The investigator searched the committed reports, scripts, docs, progress notes, and Git history (including the report at `1809cce`) and found only aggregates for the older run—no rejection IDs, per-row sample capture, or raw GNU output. The historical 30 rows cannot be reconstructed from those files. A prior DB snapshot/output was not found, so the five-position difference is unexplained; no old IDs or causes are inferred here. The current 35 rows are documented below.

### All current rank-1 0-ply rejections

Every row is classified `other/unexplained`. Each was reproduced in the current seeded run, returned at least two candidates, and had no GNU output explicitly establishing any of the three safe categories. Rolls below are high–low.

| Decision | Phase | GNU Position ID | GNU Match ID | Roll | Classification |
|---:|---|---|---|---:|---|
| 1290987 | opening | `sGfwATDgc/ABMA` | `cIm4ABAAAAAE` | 6–1 | other/unexplained |
| 1279381 | opening | `0HPkATDgc/ABMA` | `MAGzAAAAAAAE` | 6–4 | other/unexplained |
| 1279815 | opening | `4HPwATDgc/ABMA` | `cInsAAAAAAAE` | 3–1 | other/unexplained |
| 1272693 | opening | `4HPwATDgc/ABMA` | `cInsAEAAIAAE` | 3–1 | other/unexplained |
| 1266689 | opening | `4NvgATDgc/ABMA` | `cIn2ACAAAAAE` | 5–5 | other/unexplained |
| 1294975 | opening | `4HPwATDgc/ABMA` | `cInsAAAAGAAE` | 3–1 | other/unexplained |
| 1268461 | opening | `4HPwATDgc/ABMA` | `cImsACAAAAAE` | 3–1 | other/unexplained |
| 1271625 | opening | `mGfwATDgc/ABMA` | `cImlAAAAAAAE` | 3–1 | other/unexplained |
| 1284107 | opening | `4HPwATDgc/ABMA` | `cImsADAAAAAE` | 3–1 | other/unexplained |
| 1285031 | opening | `4HPKATDgc/ABMA` | `MAGnAAAAAAAE` | 6–1 | other/unexplained |
| 1285266 | middle game | `mGfwATDgc/ADIA` | `cIn2ACAACAAE` | 5–5 | other/unexplained |
| 1276884 | middle game | `sOfBATCwW/ABMA` | `MIHwAFAAIAAE` | 4–1 | other/unexplained |
| 1296118 | middle game | `rd0BAOB6bQAAAA` | `QYmuACAAEAAE` | 5–3 | other/unexplained |
| 1274405 | middle game | `4OfBADGw5+AFCA` | `MAHxAFAAIAAE` | 4–2 | other/unexplained |
| 1294789 | middle game | `2+YHACCM54UBAw` | `MIHlAAAAAAAE` | 3–1 | other/unexplained |
| 1285385 | middle game | `4OvgCSDgc/AARg` | `cAntADAAGAAE` | 3–2 | other/unexplained |
| 1268414 | middle game | `1jaDAQY29wzAAA` | `AQGvAAAAAAAE` | 6–3 | other/unexplained |
| 1279270 | middle game | `sOfgATDg8+ABUA` | `MAGuADAAAAAE` | 4–3 | other/unexplained |
| 1288719 | middle game | `4HPiASSYZ/ABMA` | `MIH2ABAAEAAE` | 5–5 | other/unexplained |
| 1289329 | middle game | `sHPkAyDg24YDIA` | `MIG6AAAAAAAE` | 6–5 | other/unexplained |
| 1274801 | middle game | `zGaTAQybbQJwEA` | `EQHzAAAAAAAE` | 6–4 | other/unexplained |
| 1280104 | middle game | `sGfwATDg88gBMA` | `MIH6ACAAIAAE` | 6–5 | other/unexplained |
| 1286255 | middle game | `tjODATB22xABIQ` | `EQH5AEAAIAAE` | 6–2 | other/unexplained |
| 1287155 | bear-off | `AwAASAAAAAAAAA` | `EgHqAAAAGAAE` | 4–2 | other/unexplained |
| 1291640 | bear-off | `MwMAgKoCAAAAAA` | `QonsABAAGAAE` | 3–1 | other/unexplained |
| 1298202 | bear-off | `KwMAgN8FAAAAAA` | `AYGsADAAGAAE` | 3–1 | other/unexplained |
| 1294966 | bear-off | `bQAAQL0CAAAAAA` | `UQnzAAAACAAE` | 6–4 | other/unexplained |
| 1286404 | bear-off | `AwAA2No+CAAAAA` | `QYm1AAAAAAAE` | 5–3 | other/unexplained |
| 1292370 | bear-off | `MgEAILUAAAAAAA` | `sAHvAGAACAAE` | 6–3 | other/unexplained |
| 1285607 | bear-off | `LQAAwG13IQAAAA` | `sIHxAGAAGAAE` | 4–3 | other/unexplained |
| 1295850 | bear-off | `1y0AAPiPAAAAAA` | `sIGqAEAAAAAE` | 5–2 | other/unexplained |
| 1287316 | bear-off | `7wEAAMYWAAAAAA` | `sIH6AEAAMAAE` | 6–5 | other/unexplained |
| 1269271 | bear-off | `KwAAYEsAAAAAAA` | `AYHuACAAGAAE` | 5–3 | other/unexplained |
| 1272124 | bear-off | `DwAA4NA/KQAAAA` | `QQnpAEAAEAAE` | 2–2 | other/unexplained |
| 1294456 | bear-off | `VwYAAE4LAAAAAA` | `8ImtAEAAEAAE` | 3–3 | other/unexplained |

Phase totals: opening 10/55, middle game 13/75, bear-off 12/70. Representative raw GNU `hint` rows (all returned depth markers are retained in the current-run diagnostic output):

- Decision 1290987, opening 6–1: `1. Cubeful 0-ply 13/7 8/7 Eq.: -0.250`; GNU labels the row `0-ply cubeful prune [expert]`.
- Decision 1274405, middle game 4–2: `1. Cubeful 0-ply 8/4* 6/4 Eq.: +1.016`; it is followed by several distinct candidate moves, also labelled `0-ply cubeful prune [expert]`.
- Decision 1287155, bear-off 4–2: `1. Cubeful 0-ply 3/off 1/off Eq.: +1.000` with 100% win, followed by `2. Cubeful 0-ply 3/off Eq.: -1.000`; both lines say `0-ply cubeful prune [expert]`, not that the bear-off database supplied an exact answer.

### The 21-roll sample row

The batch sample uses `sample[Math.floor(sample.length / 2)]` (index 100 in the 200-element array). It is a middle-game position, not a bear-off: Position ID `4HPkoQCzGfAAUg`, Match ID `sAGlAEAAEAAE`. The batch fails at unordered roll 2–2 (roll index 2, the third hint in the 21-roll order). I reproduced this roll separately with the exact board, match and dice. Its isolated `hint` begins:

```text
1. Cubeful 0-ply bar/23 13/7* Eq.: +0.299
   0-ply cubeful prune [expert]
2. Cubeful 0-ply bar/23 22/20 13/11(2) Eq.: +0.096 (-0.203)
   0-ply cubeful prune [expert]
```

All ten displayed moves for that roll are 0-ply. The same position is rejected with pruning disabled below. This is not explained by bear-off data, one legal move, or a single candidate remaining after filtering; the exact cause remains unknown.

### Pruning experiment

On three evidence-selected rejects—decision 1290987 (opening), the batch's 2–2 position (middle game), and decision 1287155 (bear-off)—I repeated the same 2-ply evaluation with `set evaluation chequerplay evaluation prune off`. GNU confirmed `will not use pruning`, but rank 1 remained 0-ply in all three. The isolated Docker wall times were approximately 0.30 s, 0.30 s and 0.33 s respectively; these include container startup. A wider move-filter command was also attempted, but GNU rejected the requested filter level/parameters, so it yielded no valid comparison and is not used as evidence. No parser path accepts any of these results.

## Loss severity comparison

Loss difference is `abs(max(0, -GNU played loss) - max(0, -Galaxy rawError))` with GNU played loss `max(0, best equity - played-move equity)`; Galaxy loss is `max(0, -rawError)`. These statistics cover only the 165 accepted analyses. The sample contained 15 Galaxy ERROR and 9 BLUNDER results among those, plus 26 DOUBTFUL results with comparable played moves:

| Galaxy severity | Comparable n | Median absolute loss difference | Mean absolute loss difference |
|---|---:|---:|---:|
| ERROR + BLUNDER | 24 | 0.0156 | 0.02185 |
| DOUBTFUL | 26 | 0.0025 | 0.00436 |

The accepted-position band splits are ERROR 11 same / 2 lower / 0 none / 2 higher (15 total), and BLUNDER 7 same / 2 lower / 0 none / 0 higher (9 total). Among the 141 accepted NONE/DOUBTFUL positions, GNU flagged 3 as ERROR/BLUNDER (3/141) and 17 as doubtful-or-higher. These do not reproduce the prior 13/2/1 of 16, 12/1/1 of 14, and 7/140: current sample severity composition differs, while all 35 rejected rows are severity NONE. The old baseline totals and the current comparison have not been combined.

## Earlier 0-ply run

The earlier phase-1 0-ply comparison reported 170/200 best-move agreement (85%) and 0.0035 median absolute played-equity difference (199 comparable decisions). This is context only; the current 2-ply figures above are the single current result.

## Recommendation

Keep GNU Backgammon as an offline, read-only comparison tool. Do not treat it as a Galaxy replacement or store results: 35/200 cases still lack an evidenced 2-ply-or-exact interpretation, and the historical 170/200 run's per-row rejections are unavailable. Preserve the fail-closed rank-1 depth requirement until a concrete harmless category is demonstrated.

## Verification

- Deterministic local read-only rerun: 200 attempted, 165 analyzed, 35 rejected (10 opening / 13 middle / 12 bear-off); 6,000 eligible rows; 148/165 agreement; all 21 rolls attempted, with the 2–2 roll rejected at 0-ply.
- Docker build for `bg-gnubg:1.07.001`: passed.
- `npm test`: 79 files / 965 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- No writes, schema/migration changes, Oracle access, UI, screenshots or pushes.
