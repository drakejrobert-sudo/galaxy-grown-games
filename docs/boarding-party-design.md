# Boarding Party — repel boarders

**Current follow-up:** [clearer threats, easier defense and first-person Life Support](boarding-party-clarity.md) supersedes this initial implementation’s artwork, traffic and interior details. The [first-person Pilot course](boarding-pilot-cockpit.md) supersedes the original Pilot design. The record below describes the original #73 handoff.

Drake approved the defensive framing, four activities, controls and Natural 1 effects on 2026-11-06, then requested implementation. This supersedes the pending offensive/defensive comparison in [#11](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/11). Offensive boarding remains outside this design. Engineering implementation and device/gameplay acceptance are separate; final owner acceptance belongs to #39.

Implementation trackers: [Pilot #69](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/69), [Gunner #70](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/70), [Bomber #71](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/71), [Life Support #72](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/72). All remain open for owner acceptance.

## Shared contract

Four independent single-player rounds, 480×560 logical pixels and 60 seconds. The GM requests each player's check. Existing modified-total bands (≤5, 6–10, 11–15, ≥16) and separate Natural 1 remain. Pause freezes all timers and retains aim/distance; pending inputs clear, resume requires fresh input, and retry resets everything. Long frame interruptions require explicit resume. Scores are manual GM reports; these games neither synchronize nor apply campaign consequences.

### Exterior stations

A carrier starts at (240,500), radius 36. Every 12 seconds it locks a target column during a 1.2-second warning, approaches y=250 until second 4, holds until second 6, withdraws to y=500 until second 9, then waits for the next cycle. The locked column is the Pilot's position at the warning, or the automatic course's predicted position at second 4. It never tracks during the approach. A line/arrow marks the approach. Pods start 45px ahead of the carrier, with up to ±20px horizontal launch spread. They follow fixed vectors toward the Pilot's predicted position (current movement projected over estimated flight time and bounded to the field) or the weapon station's predicted intercept. They do not home after launch.

- **Pilot:** full-field normalized keyboard/touch steering; pod and swept carrier contact cost one of three hull. Contacting pods disappear; misses retire harmlessly. Damage grants 1.25 seconds of grace. No weapon or fuel. Natural 1 multiplies movement speed by 0.6.
- **Gunner:** automatic ship flight at y=140. Aim at pods or carrier; each immediate shot deals one damage to the closest target within radius+7, then pod-before-carrier and entity ID break ties. Misses consume cooldown. The carrier has 36 HP. Pods crossing y=160 with their leading edge count as boarding breaches. Each damaging breach costs one of three hull; shared 1.25-second grace prevents simultaneous damage. Natural 1 doubles firing cooldown only.
- **Bomber:** automatic flight, same y=140 and boarding line. Reuse the approved aft launcher contract: rear 180°, 0–100px, default straight aft/max range, 500px/s travel, immediate rack arming, 120°/s keyboard rotation, one attempt per press and no cooldown banking. Mines last 4.5 seconds with 0.85-second cooldown and 58px blast. Swept contact triggers an explosion at its actual location; nearby pods score once and the carrier loses one HP per blast. Its station-specific health is five HP. Natural 1 multiplies radius by sqrt(0.5). Chronological breach/mine ordering prevents already-breached pods from triggering later explosions; mines win exact contact ties.

Disabling the carrier awards one bonus and stops further launches. Already launched pods stay active. The round continues to 60 seconds or hull failure. Carrier damage and disable status describe only that player's run.

### Life Support

Fixed-room rifle defense with five integrity and four cover positions at (145/335,180/350). No friendly crew. Each boarder occupies one cover position and cycles: 0.65-second warning → exposed attack countdown → 1.6-second relocation out and back through its nearest airlock → warning again. An uninterrupted exposed countdown costs one integrity, with shared 1.25-second damage grace. Shooting an exposed boarder interrupts its future attacks; covered/relocating targets block rifle hits. One shot removes at most one nearest exposed target within 25px, with ID tie-break.

Left and right zones span x=20–115 and 365–460, y=90–470. **Vent left/right**, or Q/E, starts a 0.6-second warning and an independent eight-second recharge. At warning expiry, eject every boarder currently in that zone, including covered targets. The zone is evaluated at expiry after relocation, not when the button was pressed. Ejection wins a tied attack and awards once. Empty vents consume charge; unavailable requests are discarded. Natural 1 doubles recharge to 16 seconds without changing the rifle or warning time.

## Provisional tuning and controls

| Band | Pod speed px/s | Pod interval s | Pilot speed px/s | Rifle cooldown s | Boarder interval s | Exposed attack s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Hard | 190 | 1.0 | 220 | .42 | 1.4 | 1.2 |
| Medium | 160 | 1.3 | 235 | .36 | 1.8 | 1.5 |
| Easy | 135 | 1.6 | 250 | .32 | 2.2 | 1.8 |
| Very Easy | 110 | 2.0 | 260 | .28 | 2.6 | 2.1 |

Gunner and Life Support use the approved direct touch/mouse aim exception: keyboard aim is normalized/capped at 225px/s; all inputs share firing cooldowns. Touch aims only, with a separate Fire button. Mouse primary click/hold and Space/Enter fire. Independent pointer ownership permits aim, Fire and vents together. Reticles clamp to x=12–468/y=18–542. Bomber uses the existing aft-release/Launch mine controls. Fire and vent controls remain outside the canvas, stacking on narrow screens.

## Scores, map integration and saves

Raw points: rounded survival seconds ×10 for Pilot or ×5 for other stations, +100 per health remaining, +100 per intercepted pod, +20 per carrier damage for Gunner or +100 for Bomber, +500 once for carrier disable, +100 per boarder shot and +125 per ejection. Misses, armor-only notions and duplicate removals award nothing. Use separate seeded 10th/90th-percentile anchors in scoring v0.6; old mode anchors stay fixed. Health failure caps Exceptional at Success. Numeric tuning and ratings remain provisional, requiring real playtesting.

New demos include **Boarding Party — repel boarders** at weight one alongside the four existing cards, including the rendezvous VTT card. Existing campaigns keep their libraries and tables. In GM preparation, create a minigame card with situation Boarding Party and assign a positive weight in route tables; end active journeys first to unlock library editing. Share links carry only `?situation=boarding-party`; players choose roles and checks themselves. The map pauses until explicit GM resolution.

Archive versions 1/2 and storage key `galaxy-grown-map-v1` are retained. New validation accepts the situation value without changing the archive shape. Older app builds cannot read Boarding Party cards; export a backup before moving between revisions. Existing saves are not automatically populated or rewritten on read.

## Acceptance

See [engineering evidence and owner checklist](boarding-party-playtest.md). Follow implementation → engineering checks → Drake review/merge → automatic deployment verification → Drake playtesting → issue closure. Use `Refs` issue links while owner acceptance remains pending. Never treat design approval, a merge, synthetic calibration or Chromium emulation as real-device/final balance acceptance.
