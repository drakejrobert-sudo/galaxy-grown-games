# Boarding Party clarity and pacing follow-up

Drake requested this follow-up after playing the original prototype: Gunner at check 10 and Bomber felt too difficult; Life Support was difficult to understand. The approved 2026-11-06 plan adds distinct illustrated threats, easier weapon-station pacing and a first-person interior. It supersedes the relevant artwork, traffic and interior sections of [the initial design](boarding-party-design.md). Refs #69, #70, #71, #72, #39. Design approval is separate from owner acceptance.

## Exterior craft and movement

Original generated carrier, probe and shuttle sprites replace the generic carrier and triangular pods. Probes are radius 12 / one turret hit; shuttles are radius 18 / two turret hits and use 75% probe speed before any close-launch speed cap. Each launch independently selects probe below random 0.8 and shuttle otherwise. One mine destroys either. Both retain the existing 100-point interception reward; the report separately counts probes and shuttles. Damaged shuttles show remaining health pips and hit feedback.

The carrier locks its approach endpoint during the existing 1.2-second warning, offset alternately ±45px from the predicted target column and bounded to x=80–400. It now interpolates diagonally from its starting column while closing y=500→250, holds until second six, returns along the same path until second nine, then repositions laterally toward alternating x=360/120 before the next 12-second cycle. The visible warning shows the committed approach. Its hit radius, health, disable behavior and Bomber mine opportunity are unchanged.

Incoming craft use alternating launch ports 28px from the carrier center and a bounded ±40px target offset. The launch direction is committed once; there is no homing or random turn afterward. The player's automatic eight-second sideways sweep is unchanged.

## Gentler Gunner and Bomber

Only Boarding Party Gunner/Bomber use the new defense table:

| Band | Probe speed px/s | Launch interval s |
| --- | ---: | ---: |
| Hard | 155 | 1.35 |
| Medium, including check 10 | 125 | 1.8 |
| Easy | 105 | 2.1 |
| Very Easy | 90 | 2.5 |

The first craft appears at two seconds. It remains shootable/minable at its launch location for a visible 0.6-second warning, then follows its fixed vector. If a close launch would reach the boarding line in under 0.8 seconds, scale both velocity components down together. This preserves direction and guarantees at least 1.4 seconds between appearance and breach, even for a shuttle at the closest carrier approach. Warning expiry is included in swept mine paths and chronological breach resolution.

Turret cooldowns, three hull, collision grace and the entire aft-launcher contract remain unchanged. Natural 1 still halves Gunner fire rate or Bomber blast area. Pilot retains its previous speed table but launches craft at 80% of its prior interval, as approved for a modest density increase; it does not use the weapon stations' launch warning/speed cap.

## First-person Life Support

The player holds one stationary corridor position. A generated corridor, rifle and hostile boarder art replace the overhead icons. Rule-owned depth controls position, scale and target radius; art never defines collision geometry. Cover masks lower bodies, exposed targets have clear aiming/firing cues, incoming lasers have a visible travel path and damage flashes identify their source side. Covered and relocating targets block rifle fire.

Four independent slots cap active boarders at four. The first appears at two seconds. Each cycles through 0.65 seconds covered warning, an exposed aiming countdown, a laser shot and a 1.6-second relocation through a visibly lit side airlock bay. Relocation advances far→middle→near; near boarders repeat from near cover. The original difficulty table controls spawn interval, rifle cooldown and base attack countdown.

| Depth | Scale | Target radius | Attack countdown multiplier | Laser flight time |
| --- | ---: | ---: | ---: | ---: |
| Far | .65 | 18 | 1.25 | .9s |
| Middle | .9 | 24 | 1 | .65s |
| Near | 1.15 | 30 | .85 | .45s |

A shot damages the player when its visible bolt arrives, not when the enemy fires. Shared 1.25-second grace prevents simultaneous impacts from removing several integrity. Killing/ejecting a boarder stops future shots but never deletes a bolt already in flight. Ejection wins a tied attack emission; an already-fired bolt still resolves independently. Relocation spends its middle third inside the airlock, with travel in/out allowing a vent warning to complete while the bay is occupied.

Five integrity, rifle rewards, direct pointer/capped keyboard aim, separate Fire and independent Q/E vent controls remain. Airlocks retain 0.6-second warning, eight-second recharge, empty-vent cost and discarded unavailable requests. Natural 1 doubles recharge to 16 seconds and leaves rifle/laser timings alone. Opening guidance explains raised rifles, red lasers and lit bays; setup/play help uses the same terms.

## Delivery and acceptance

No encounter URL, archive version, storage key or campaign library migration is introduced. All games remain independent 60-second runs with explicit pause/resume and manual GM consequences. Retry clears craft health/warnings, lasers, depth, counters and vent state. Scoring v0.7 recalibrates only the four Boarding Party anchors; the original eight anchors and sample references remain fixed.

See [engineering validation and remaining owner checks](boarding-party-clarity-playtest.md), [artwork provenance](illustrated-artwork.md) and the [exact built-in image-generation prompts](boarding-art-prompts.json). A reviewable PR does not establish deployment or owner/device acceptance. Keep #69–#72 and #39 open until Drake explicitly accepts the tested revision with the applicable coverage.
