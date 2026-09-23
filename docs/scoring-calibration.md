# Provisional common scoring — v0.2

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

Run `node --import tsx scripts/calibrate-scores.ts` from the repository root. The script uses the actual game stepping and raw-score functions, a 50 ms step, fixed pseudorandom seeds, and three scripted input profiles: passive, routine, and engaged. It runs each profile with 12 seeds at one representative total in each of the four difficulty bands, with and without Natural 1: 288 runs per mode. Each mode pools all those scores, then uses the observed 10th and 90th percentiles as its fixed low/high anchors. Pooling means the rating does not silently compensate for a harder check or Natural 1. There is no theoretical maximum for some kill-based modes, so the 90th percentile is a practical reference, not a maximum.

| Mode | Runs | Observed min | Low (10th) | Median | High (90th) | Observed max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Asteroid Field / Pilot | 288 | 51 | 66 | 110 | 700 | 900 |
| Asteroid Field / Gunner | 288 | 20 | 25 | 3,207 | 7,200 | 10,900 |
| Asteroid Field / Bomber | 288 | 31 | 71 | 1,246 | 3,060 | 5,138 |
| Asteroid Field / Life Support | 288 | 0 | 150 | 1,000 | 7,800 | 9,500 |
| Space Battle / Pilot | 288 | 57 | 63 | 91 | 332 | 710 |
| Space Battle / Bomber | 288 | 30 | 64 | 969 | 5,800 | 8,500 |

These profiles are simple scripts, not models of human skill. For example, the engaged Gunner picks a visible asteroid, while the engaged Pilot reacts to a nearby hazard. The spread supports provisional UI and regression tests; it does **not** establish fair difficulty or approve thresholds. Keep these anchors with rating version v0.2 so an older report can be interpreted against the values used when it was made. Adding a new mode requires its own documented simulation samples and fixed anchor pair. Recalibrating an existing mode requires a new rating version and an explicit review of how old and new reports compare.

## Real playtest review before final thresholds

Record at least several completed and failed runs per mode across the four difficulties, including Natural 1, using only mode, modified total, Natural 1 flag, raw score, rating, end reason, and whether the GM thought the band described the performance. No player identities or campaign details are needed. Compare real score distributions and GM judgments with these synthetic anchors. Adjust anchors or bands only in a separately reviewed versioned change; leave issue #33 open until Drake reviews those samples and accepts or revises the thresholds.
