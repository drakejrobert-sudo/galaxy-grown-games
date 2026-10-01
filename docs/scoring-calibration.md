# Provisional common scoring — v0.5

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

## Space Battle / Life Support addition — v0.4

The new platformer adds a seventh mode without changing the six existing rating anchors, raw-score rules, or advisory bands. Its provisional raw score is 100 per ordinary fire stomp, 150 per electrical repair, survival seconds × 5 rounded to the nearest point, and 100 per remaining integrity. Integrity failure caps only the advisory band at Success.

The same seeded calibration script ran 288 Space Battle / Life Support simulations across four difficulty bands, with and without Natural 1, using passive, routine, and engaged movement/repair scripts. These scripts are coarse navigation approximations, not human players. They produced:

| Mode | Runs | Observed min | Low (10th) | Median | High (90th) | Observed max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Space Battle / Life Support | 288 | 97 | 128 | 398 | 1,350 | 2,150 |

The fixed **130–1,350** anchor is a playtest starting point. The corrected fractional-second scoring changes the synthetic 10th percentile to 128; the provisional fixed anchor remains 130. Check completed and failed real runs, especially whether the high anchor makes modest repairs rate too highly. Earlier v0.2 and v0.3 reports retain their historical meaning; the v0.4 label marks the addition of this mode.

## Space Battle / Gunner addition — v0.5

The eighth mode adds turret defense without changing any existing mode's fixed anchors, raw-score rules, or advisory bands. Points are 100 per attacker destroyed, 25 per projectile intercepted, `round(elapsed seconds × 5)`, and 100 per remaining hull. Armor damage and breaches award nothing; hull failure caps only the advisory band.

The design's 288 seeded simulations use the existing seeds, 50 ms steps, four bands, and both Natural 1 states. Passive never fires. Routine targets the lowest attacker below y = 168. Engaged targets the threat with the shortest time to its bottom edge crossing the defense line. Active profiles aim directly and hold fire when a target exists; target ties use the lowest entity ID. They do not model keyboard aiming or human performance.

| Mode | Runs | Observed min | Low (10th) | Median | High (90th) | Observed max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Space Battle / Gunner | 288 | 36 | 37 | 2,038 | 5,000 | 6,000 |

The fixed **37–5,000** pair exactly uses those observed percentiles. The seven older calibration rows and live anchors remain unchanged; historical v0.2–v0.4 reports retain their meaning. Natural 1 doubles the selected cooldown; simulation retains fractional cooldown overshoot while firing so timestep rounding does not distort its sustained rate. A quick attempt during cooldown is discarded, never banked. Final tuning requires Drake's completed/failed real-run judgments and device checks under #39.

## Real playtest review before final thresholds

Record at least several completed and failed runs per mode across the four difficulties, including Natural 1, using only mode, modified total, Natural 1 flag, raw score, rating, end reason, and whether the GM thought the band described the performance. No player identities or campaign details are needed. Compare real score distributions and GM judgments with the synthetic references and current fixed anchors. Adjust anchors or bands only in a separately reviewed versioned change; the current values remain provisional until Drake accepts them after broader playtesting.


## Space Battle Life Support hazard pass — scoring unchanged

The #42 spark/fire-contact pass retains scoring v0.5, the existing raw formula, and the **130–1,350 live rating anchors**. New hit counters are report-only. A rating of 100 reaches a provisional points threshold, not a flawless-run criterion.

Re-running the same 288 seeded passive/routine/engaged simulations after adding hazards produced:

| Mode | Samples | Minimum | p10 | Median | p90 | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Space Battle / Life Support | 288 | 53 | 80 | 246 | 926 | 2,050 |

Earlier results were minimum 97, p10 128, median 398, p90 1,350, maximum 2,150. These are coarse scripted movements that do not deliberately dodge sparks; they demonstrate changed pressure, not human difficulty or a justification to lower anchors. Other seven mode distributions are unchanged. Rating recalibration awaits recorded owner runs across all bands and Natural 1. See [hazard validation](issue-42-life-support-hazards.md).

## Space Battle station simplification — existing anchors retained

Mine-only Bomber removes missiles/forward attackers and uses committed pursuers and one press per mine. Life Support now accumulates 1.5 seconds of proximity repair, preserving interruption progress. Raw-score formulas, live v0.5 anchors (Bomber 64–3,300; Life Support 130–1,350), and advisory/failure rules remain unchanged by agreement. These anchors describe older gameplay and need fresh owner calibration; new reports should be identified with the station redesign build/PR when collecting samples.

The updated script models routine Bomber taps when ready and engaged taps when an enemy column is within 20px of the aft rack and its arrival is between the arming delay and mine lifetime. Life Support uses navigation/jump profiles with automatic repairs. Passive can now incidentally repair nearby panels. The same 288-run seeded matrix yields:

| Mode | Runs | Min | 10th | Median | 90th | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Space Battle / Bomber | 288 | 25 | 30 | 146 | 459 | 878 |
| Space Battle / Life Support | 288 | 53 | 79 | 178 | 677 | 1,255 |

These low synthetic results are a calibration warning, not a human balance verdict or replacement rating anchors. Other modes reproduce their existing synthetic references. Collect completed/failed owner runs across bands and Natural 1 before a separately reviewed rating adjustment.

## Higher Space Battle Bomber station

Following owner feedback after the mine-only redesign, the Bomber now sits at y = 140 (25% of the 560px playfield) instead of y = 313.6 (56%). Mines still drop 34px behind it, now at y = 174. This adds 173.6px of approach space, about 0.86–1.88 seconds depending on the pursuer's selected speed. Predicted intercepts use the new ship height automatically. Flight weave, enemy cadence/speed, mine rules, raw points and live anchors are unchanged.

The same 288 synthetic Bomber runs now yield min 29, p10 37, median 144, p90 361, max 578. The other seven modes reproduce their prior results. These scripts still do not establish human timing or rating fairness; owner playtesting and separate rating calibration remain pending.

## Aimed aft launcher and clean passes — anchors retained

Space Battle Bomber now launches mines 100 logical pixels through the rear half-circle over 0.2 seconds, arming at a fixed landing point. Clean flight-line crossings retire pursuers. The upper-quarter ship height, eight-second course, enemy speeds/cadence, 0.85-second cooldown, 4.5-second lifetime from launch, Natural-1 half-area blast, raw scoring, and **64–3,300 live anchors** remain unchanged.

The seeded profile script now uses straight-aft, ready-on-cooldown launches for routine play. Engaged play aims at a committed column's predicted position when the mine lands, launching when that point is within 20px of the 100px launch radius. Passive never launches. This is deliberately synthetic and the engaged profile's accurate prediction is not representative of human aiming.

| Mode | Runs | Min | 10th | Median | 90th | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Space Battle / Bomber | 288 | 32 | 37 | 245 | 5,100 | 6,100 |

All seven other modes reproduce their previous references. The larger upper tail reflects changed gameplay and scripted targeting, not an approved rating adjustment. Preserve the historical rows above. Collect fresh completed/failed human runs across all four difficulty bands with/without Natural 1; gameplay acceptance and rating calibration remain separate owner gates. Life Support's earlier automatic-repair change still needs fresh human calibration too.

## Shorter placement and in-flight impacts — live anchors retained

The follow-up lets pointer targets choose 0–100px from the aft rack at 500px/s and permits direct contacts during travel. Routine still launches straight aft at maximum range when ready. Engaged selects the nearest active pursuer behind the rack and within 100px, targeting its current position when ready (entity ID breaks equal-distance ties). Passive never launches. There is no extra prediction or rating adjustment.

| Mode | Runs | Min | 10th | Median | 90th | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Space Battle / Bomber | 288 | 32 | 37 | 361 | 5,100 | 6,100 |

The median was 245 in the fixed-range aft-launcher reference above; the other listed percentiles and all seven other modes reproduce their previous references. Keep Bomber’s **64–3,300 live anchors**, raw formula, scoring version and difficulty bands. These scripted results are supporting engineering evidence, not human calibration. Fresh completed/failed owner runs across bands and Natural 1 remain required; gameplay acceptance and rating calibration are separate gates.


## Release-frame mine timing correction — anchors retained

PR #50 review identified a one-frame delay before newly launched travelling mines moved or detected contacts. Travel and lifetime now include the release step: 100px lands after 0.2 seconds total, and 25px can land within a single 0.05-second step. Routine/engaged profiles remain unchanged.

| Mode | Runs | Min | 10th | Median | 90th | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Space Battle / Bomber | 288 | 32 | 37 | 367 | 5,100 | 6,100 |

The prior median of 361 remains recorded above. All other Bomber percentiles and the seven other modes reproduce their previous references. Raw scoring and the 64–3,300 live anchors remain unchanged; these synthetic samples do not replace owner gameplay acceptance or human calibration.
