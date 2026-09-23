# Provisional common scoring — v0.3

Issue #33 adds a **0–100 advisory rating** to each completed run. Raw points and role-specific statistics remain intact. The rating uses a fixed low/high pair for each playable mode:

`rating = clamp(round(100 × (raw points − low) / (high − low)), 0, 100)`

| Rating | Advisory band |
| ---: | --- |
| 0–24 | Setback |
| 25–49 | Mixed |
| 50–74 | Success |
| 75–100 | Exceptional |

A hull, integrity, or fuel failure caps the **band** at Success. It does not reduce the numeric rating or raw points; the report explains a cap when one applies. The entered final check total and Natural 1 already change gameplay and are shown as context. Neither applies another rating modifier. Bands are performance advice to the GM, not automatic story outcomes, rewards, upgrades, or changes to campaign records.

## Reproducible synthetic calibration

Run `node --import tsx scripts/calibrate-scores.ts` from the repository root. The script uses the actual game stepping and raw-score functions, a 50 ms step, fixed pseudorandom seeds, and three scripted input profiles: passive, routine, and engaged. It runs each profile with 12 seeds at one representative total in each of the four difficulty bands, with and without Natural 1: 288 runs per mode. Each mode pools all those scores. The observed 10th and 90th percentiles became the original **v0.2** low/high anchors. Pooling means the rating does not silently compensate for a harder check or Natural 1. There is no theoretical maximum for some kill-based modes, so the 90th percentile is a practical reference, not a maximum.

| Mode | Runs | Observed min | Low (10th) | Median | High (90th) | Observed max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Asteroid Field / Pilot | 288 | 51 | 66 | 110 | 700 | 900 |
| Asteroid Field / Gunner | 288 | 20 | 25 | 3,207 | 7,200 | 10,900 |
| Asteroid Field / Bomber | 288 | 31 | 71 | 1,246 | 3,060 | 5,138 |
| Asteroid Field / Life Support | 288 | 0 | 150 | 1,000 | 7,800 | 9,500 |
| Space Battle / Pilot | 288 | 57 | 63 | 91 | 332 | 710 |
| Space Battle / Bomber | 288 | 30 | 64 | 969 | 5,800 | 8,500 |

These profiles are simple scripts, not models of human skill. For example, the engaged Gunner picks a visible asteroid, while the engaged Pilot reacts to a nearby hazard. The spread supports provisional UI and regression tests; it does **not** establish fair difficulty or approve thresholds. The table preserves every v0.2 anchor so older manual reports can be interpreted against the values used when they were made.

## Owner playtest adjustment — v0.3

Drake reported that a Space Battle / Pilot run with roughly 300–500 raw points reached a 100 rating despite feeling like Mixed performance. Drake also supplied a Space Battle / Bomber report: Easy, 1,832 raw points, 17 ships destroyed, hull depleted at 26.3 seconds. Its v0.2 rating was 31 (Mixed), while Drake judged it one band higher. The two high anchors below adjust the rating conversion only; all low anchors, raw-score formulas, difficulty effects, and failure rules stay the same.

| Mode | Low | v0.2 high | v0.3 high | Example v0.3 rating |
| --- | ---: | ---: | ---: | --- |
| Space Battle / Pilot | 63 | 332 | 1,000 | 300–500 points → 25–47 (Mixed) |
| Space Battle / Bomber | 64 | 5,800 | 3,300 | 1,832 points → 55 (Success); about 1,200 → 35 (Mixed) |

The four other modes retain their v0.2 anchors in v0.3. These two changes are provisional owner-guided calibration, not new simulation percentiles. Adding a new mode requires its own documented samples and fixed anchor pair. Recalibrating an existing mode requires a new rating version and a review of how old and new reports compare.

## Real playtest review before final thresholds

Record at least several completed and failed runs per mode across the four difficulties, including Natural 1, using only mode, modified total, Natural 1 flag, raw score, rating, end reason, and whether the GM thought the band described the performance. No player identities or campaign details are needed. Compare real score distributions and GM judgments with the synthetic references and v0.3 anchors. Adjust anchors or bands only in a separately reviewed versioned change; the current values remain provisional until Drake accepts them after broader playtesting.
