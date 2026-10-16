# GNU Backgammon engine test — 2-ply follow-up

## Setup and method

The local arm64 image is `bg-gnubg:1.07.001`, built from `engine/gnubg/Dockerfile` (Debian Bookworm, `gnubg` plus `gnubg-data`). The harness is `npx tsx scripts/engine/gnubg-evaluation.ts`. It reads only local `app_dev` through `prismaReadOnly` and `localDbUrl("ro")`, checks localhost and `bg_db_ro`, and makes no writes or Galaxy calls. It takes the same stratified 200 rows (55 opening, 75 middle game, 70 bear-off) from 6,000 eligible rows, with the deterministic seeded shuffle.

GNU returns per-candidate depth. This update tests the single-survivor move-filter hypothesis on the same seeded sample. The configured 2-ply filter threshold is 0.16 (`show evaluation` in the image). All 35 previous rank-1 0-ply rejects had only one 0-ply move within that threshold; all 165 previously accepted positions had at least two. Three representative rejects returned rank 1 at 2-ply after widening the 2-ply filter to 1.0. The parser now accepts rank-1 0-ply only when every listed candidate is 0-ply and the rank1-rank2 gap exceeds the filter threshold, or only one candidate is listed. It labels these analyses `depthReason: "single-survivor"` while retaining candidate plies 0; mixed-depth and below-threshold cases still throw.

## Current 2-ply rerun

| Measure | Result |
|---|---:|
| Attempted / analyzed / rejected | 200 / 200 / 0 |
| Prior 2-ply rank-1 cases / newly accepted single-survivors | 165 / 35 |
| Best-move agreement (all / with / without single-survivor rows) | 183/200 (91.5%) / 35/35 (100%) / 148/165 (89.7%) |
| Median absolute played-equity difference | 0.0027 (200 measured) |
| Absolute played-loss difference (all / with / without) | n=200, median 0; n=35, median 0 / mean 0; n=165, median 0 / mean 0.004145 |
| Empty Docker run median (5 runs) | 277.7 ms |
| Single-position total / estimated engine work (median) | 346.9 / 69.2 ms |
| All 21 rolls total / estimated engine work | 928.5 / 650.8 ms; no depth error; 20 legal rolls plus 6–6 with no legal move |

The 200 rows, 6,000 eligible records and deterministic phase strata (55 opening, 75 middle game, 70 bear-off) are unchanged. The former 35 rejects became accepted `single-survivor` rows, raising coverage from 165/200 to 200/200. With those rows excluded, best-move agreement remains 148/165; they add 35 agreements and no loss difference. The historical 170/200 result still has no per-row IDs/raw outputs and its five-position discrepancy remains unexplained.

The deterministic row sampler and the historical baseline are unchanged. The 170/200 phase-1 result remains unreconciled: no per-row IDs or raw GNU output for that run were found in the committed reports, scripts, docs, progress notes or Git history. The five-position difference is not explained or inferred here.

### Measured 0-ply gaps against the configured move filter

`show evaluation` inside `bg-gnubg:1.07.001` reported that the 2-ply filter keeps up to 8 extra moves within equity `0.16`; the same 0.16 threshold was reported for 1-ply. I ran a 0-ply hint for all positions in the same deterministic 200-row sample and compared the top two equities. Every one of the 35 default 2-ply rejects had exactly one listed candidate within 0.16. Every one of the 165 default 2-ply accepted positions had at least two candidates within 0.16. Their top-two gap summary was min 0.000, median 0.023, max 0.155. The rejected gaps ranged from 0.161 to 2.000.

| Decision | Phase | Roll | Rank 1 | Rank 2 | Gap | Candidates within 0.16 |
|---:|---|---:|---:|---:|---:|---:|
| 1290987 | opening | 6–1 | -0.250 | -0.423 | 0.173 | 1 |
| 1279381 | opening | 6–4 | 0.375 | 0.132 | 0.243 | 1 |
| 1279815 | opening | 3–1 | 0.219 | -0.012 | 0.231 | 1 |
| 1272693 | opening | 3–1 | 0.243 | -0.014 | 0.257 | 1 |
| 1266689 | opening | 5–5 | 0.002 | -0.171 | 0.173 | 1 |
| 1294975 | opening | 3–1 | 0.151 | -0.083 | 0.234 | 1 |
| 1268461 | opening | 3–1 | 0.308 | 0.070 | 0.238 | 1 |
| 1271625 | opening | 3–1 | -0.046 | -0.284 | 0.238 | 1 |
| 1284107 | opening | 3–1 | 0.345 | 0.095 | 0.250 | 1 |
| 1285031 | opening | 6–1 | -0.013 | -0.227 | 0.214 | 1 |
| 1285266 | middle game | 5–5 | 0.253 | 0.013 | 0.240 | 1 |
| 1276884 | middle game | 4–1 | 0.137 | -0.137 | 0.274 | 1 |
| 1296118 | middle game | 5–3 | 0.270 | 0.074 | 0.196 | 1 |
| 1274405 | middle game | 4–2 | 1.016 | 0.637 | 0.379 | 1 |
| 1294789 | middle game | 3–1 | -0.194 | -0.781 | 0.587 | 1 |
| 1285385 | middle game | 3–2 | -0.100 | -0.363 | 0.263 | 1 |
| 1268414 | middle game | 6–3 | 0.293 | 0.090 | 0.203 | 1 |
| 1279270 | middle game | 4–3 | -0.144 | -0.600 | 0.456 | 1 |
| 1288719 | middle game | 5–5 | 0.988 | 0.823 | 0.165 | 1 |
| 1289329 | middle game | 6–5 | 0.725 | 0.161 | 0.564 | 1 |
| 1274801 | middle game | 6–4 | 0.223 | 0.048 | 0.175 | 1 |
| 1280104 | middle game | 6–5 | -0.014 | -0.217 | 0.203 | 1 |
| 1286255 | middle game | 6–2 | 0.536 | 0.241 | 0.295 | 1 |
| 1287155 | bear-off | 4–2 | 1.000 | -1.000 | 2.000 | 1 |
| 1291640 | bear-off | 3–1 | -0.194 | -0.393 | 0.199 | 1 |
| 1298202 | bear-off | 3–1 | -0.600 | -0.929 | 0.329 | 1 |
| 1294966 | bear-off | 6–4 | -0.680 | -0.961 | 0.281 | 1 |
| 1286404 | bear-off | 5–3 | -1.000 | -2.310 | 1.310 | 1 |
| 1292370 | bear-off | 6–3 | -0.418 | -0.594 | 0.176 | 1 |
| 1285607 | bear-off | 4–3 | -1.122 | -1.326 | 0.204 | 1 |
| 1295850 | bear-off | 5–2 | 0.670 | 0.010 | 0.660 | 1 |
| 1287316 | bear-off | 6–5 | 0.184 | -0.327 | 0.511 | 1 |
| 1269271 | bear-off | 5–3 | -0.748 | -0.998 | 0.250 | 1 |
| 1272124 | bear-off | 2–2 | -1.447 | -1.608 | 0.161 | 1 |
| 1294456 | bear-off | 3–3 | 0.130 | -0.063 | 0.193 | 1 |

Phase totals for the 35 single-survivor rows are opening 10, middle game 13, bear-off 12. The lowest gap is decision 1272124 (bear-off, 2–2), 0.161; it still exceeds the measured 0.16 filter threshold.

### Widened move-filter confirmation

GNU help inside the image returned `set evaluation movefilter <ply> <num.xjoin to accept (0 = skip)> [<num. of extra moves to accept> <tolerance>]`. Using its accepted argument order, `set evaluation movefilter 2 0 0 8 1.0` changed the 2-ply filter threshold to 1.0, confirmed by `show evaluation`. With that setting, rank 1 was 2-ply on all three rejects:

| Reject | Roll | Widened-filter rank 1 | Rank 2 | Docker wall time |
|---|---:|---|---|---:|
| 1290987 (opening) | 6–1 | 2-ply `13/7 8/7` | 2-ply | 0.405 s |
| 1296118 (middle game) | 5–3 | 2-ply `5/off 3/off` | 2-ply | 0.335 s |
| 21-roll sample position | 2–2 | 2-ply `bar/23 13/7*` | 2-ply | 0.490 s |

Times include Docker startup. For the 21-roll sample's 2–2 hint, the default-filter 0-ply equities were +0.299 and +0.096 (gap 0.203); the widened-filter 2-ply equities were +0.290 and +0.099.

### The 21-roll sample

The same sample-100 position (`4HPkoQCzGfAAUg`, match `sAGlAEAAEAAE`) now returns all 21 roll results without a depth error. Twenty rolls have legal moves and candidates; 6–6 has no legal move and is represented as an empty candidate list. Total wall time was 928.5 ms (650.8 ms estimated engine time after Docker startup). The 2–2 roll is accepted with `depthReason: "single-survivor"` and its candidate plies remain 0 at the default filter; widening the filter makes it 2-ply as above.

## Loss severity comparison

Loss difference is `abs(max(0, -GNU played loss) - max(0, -Galaxy rawError))` with GNU played loss `max(0, best equity - played-move equity)`; Galaxy loss is `max(0, -rawError)`. The breakdown below is the 165-position 2-ply-rank-1 subset (excluding single-survivor rows). The sample contains 15 Galaxy ERROR and 9 BLUNDER results in this subset, plus 26 DOUBTFUL results with comparable played moves:

| Galaxy severity | Comparable n | Median absolute loss difference | Mean absolute loss difference |
|---|---:|---:|---:|
| ERROR + BLUNDER | 24 | 0.0156 | 0.02185 |
| DOUBTFUL | 26 | 0.0025 | 0.00436 |

The 2-ply-only band splits are ERROR 11 same / 2 lower / 0 none / 2 higher (15 total), and BLUNDER 7 same / 2 lower / 0 none / 0 higher (9 total). Among the 141 NONE/DOUBTFUL positions in that subset, GNU flagged 3 as ERROR/BLUNDER (3/141) and 17 as doubtful-or-higher. The old baseline totals and current comparison are not combined.

## Earlier 0-ply run

The earlier phase-1 0-ply comparison reported 170/200 best-move agreement (85%) and 0.0035 median absolute played-equity difference (199 comparable decisions). This is context only; the current 2-ply figures above are the single current result.

## Recommendation

Keep GNU Backgammon as an offline, read-only comparison tool. The 35 newly covered rows are evidence for a narrow single-survivor category, not deeper evaluations: candidate plies stay 0. Do not treat GNU as a Galaxy replacement or store results. The historical 170/200 run's per-row data remains unavailable.

## Verification

- Deterministic local read-only 0-ply gap run: 200 positions (165 previously accepted, 35 previous rejects); every previous reject gap exceeded 0.16, minimum 0.161, and each had one listed candidate within threshold; all 165 others had at least two (gap min/median/max 0.000/0.023/0.155).
- Widened 2-ply filter (`set evaluation movefilter 2 0 0 8 1.0`) on three rejects: 2-ply rank 1 returned on all; Docker wall times 0.405 / 0.335 / 0.490 s.
- Parser rerun: 200/200 analyzed, 35 labeled `single-survivor`; 183/200 best-move agreement. Without those rows: 148/165 agreement, loss-difference median/mean 0 / 0.004145. With them: 35/35 agreement, median/mean 0 / 0.
- All 21 rolls on the sample-100 position: 20 legal-roll analyses plus 6–6 no legal move; no depth error, 928.5 ms total / 650.8 ms estimated engine time.
- `npm test`: 79 files / 967 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
