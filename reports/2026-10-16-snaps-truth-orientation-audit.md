# Snaps saved truths: orientation audit (2026-10-16)

Investigator, read-only, local files. For each `snap-poc/truth/*.json`, pip counts for the four ownership/home combinations (bottomColor dark|light × bottomHome right|left, no rotate), judged by which puts each colour's checkers toward its own home with plausible pips. Re-implemented in jq from `lib/snapPocLayout.ts` / `lib/pipCount.ts`; matches the repo code on PXL (269/314 saved, 106/61 light/left). Check every row by eye on the photo before re-saving. "Home left" = bottom player's home on the photo's left. Pips are dark / light.

**Saved looks right (9):** 11.37.11, 11.42.38, 11.43.00, 11.43.23, 11.45.04, 11.47.48, 111138, 111159, 111748.

**Saved is wrong (10):**

| Photo | Likely | Pips D/L |
|---|---|---|
| PXL_20260927_142233229 | light near, home left | 106 / 61 |
| 11.37.57 | dark near, home left | 123 / 114 |
| 11.38.18 | dark near, home left | 123 / 111 |
| 11.38.43 | light near, home right | 169 / 151 |
| 11.47.15 | home left (opening; colour by eye) | 167 / 167 |
| 11.48.05 | home left (opening; colour by eye) | 167 / 167 |
| 11.48.53 | light near, home right | 97 / 80 |
| 11.50.16 | dark near, home left | 83 / 50 |
| 111412 | light near, home left | 60 / 70 |
| 111831 | light near, home right | 95 / 108 |

**Probably wrong (7), choose by eye:** 11.41.08 (dark/left 152/169 or light/right 164/193), 11.44.39 (light/right 183/148 or dark/left 183/208), 11.49.57 (dark/left 120/130), 11.50.33 (dark/left 157/152), 111614 (light/right 129/172 or dark/left 141/184), 111655 (dark/left 83/143), 111935 (light/right 163/151 or light/left 176/177).

**Can't tell (2):** 11.44.05, 111901.

With the two-step card (`/snap-poc`), "light near, home left" = Analyzing for Light, Home board 3 (bottom-left), no step-1 transforms.
