# Space Battle / Gunner — design handoff

Design tracker: [#11](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/11). Status: **core activity, controls, and Natural 1 approved by Drake on 2026-09-27; implementation pending**. The detailed rules below are the reviewable implementation design. All numeric tuning and rating anchors require final owner playtesting; design approval is not final game acceptance.

Implementation: [#38](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/38), after review/merge of this design. Final owner acceptance: [#39](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/39), covering gameplay, balance, ratings, and real iPhone/iPad Safari plus desktop controls for all 12 combinations. Earlier prototype playtests are evidence, not automatic final signoff. Existing #3 and #10 acceptance work remains open and linked there.

## Approved direction and boundaries

Operate a turret on an automatically flying ship. Destroy approaching attackers and intercept their incoming projectiles before they cross a visible defense line. Choosing between stopping an immediate projectile and destroying its source is the central decision. Aiming never steers the ship. There are no mines, player missiles, fuel management, multiplayer, or automatic campaign effects in this mode.

Support direct touch/mouse aiming and normalized, speed-capped keyboard aiming. This is an explicitly approved reticle-speed exception recorded in AGENTS.md: pointer placement is direct while keyboard movement is capped at 225 logical pixels/second; firing cooldowns are identical across inputs, not reticle speeds. Natural 1 doubles the selected difficulty's firing cooldown, halving sustained fire rate without changing damage, aim, or the difficulty band. Preserve final modified totals <=5 Hard, 6–10 Medium, 11–15 Easy, >=16 Very Easy, including negative totals. Never add modifiers or apply a second scoring penalty.

Asteroid Gunner keeps its existing pointer-only exception. Boarding Party stays disabled until its own core activities and Natural 1 adaptations are approved.

## Round, threats, and hit resolution

- Use the existing 480 × 560 logical playfield, 60-second duration, three hull points, and automatic weapon-station flight path. The ship represents the defended station; damage is resolved at the defense line, not by proximity to the decorative ship position.
- Put the defense line at y = 492. Start the reticle at (240, 280); clamp it to x = 12–468 and y = 18–484. Ship movement does not move the reticle.
- Spawn attackers at y = -24, with radius 20 and random x within 20–460. They descend vertically; each has one hull point or two if armored. Draw armor pips and a distinct armored silhouette. Spawn the first attacker at 0.7 seconds, then use the selected difficulty's cadence.
- An attacker fires exactly one projectile when its center first reaches y = 180. Telegraph that shot from y = 140 onward. Spawn the projectile at (attacker.x, attacker.y + 26); it travels straight down, has radius 10, and is destroyed by one turret hit. Destroying an attacker prevents future firing but does not erase a projectile already launched. Use a distinct projectile shape/trail as well as color.
- Turret fire is an immediate shot at the reticle, with a short visible beam from the ship. Hit candidates have centers within their radius + 7 logical pixels of the reticle; choose the nearest center, then a projectile before an attacker on an exact tie, then the lowest entity ID. One shot hits at most one target and deals one damage. A miss still consumes the cooldown. Do not introduce line-of-sight blocking or area damage.
- Resolve each simulation step in this order: decrease timers and update aim; resolve at most one player shot; spawn/move attackers and emit their one-time shots; move projectiles; resolve defense-line crossings; finalize score/end state. A player hit therefore wins over a same-step enemy shot or breach. Clamp elapsed steps as existing modes do; newly emitted projectiles begin moving on the following step.
- An attacker or projectile breaches when its bottom edge reaches the defense line. Remove every crossing threat. If damage grace is inactive, any crossings in that step cost one hull and start 1.25 seconds of grace; further crossings during grace cause no damage or points. Count damaging hits separately from total breached threats. Show the protection state clearly.
- End at zero hull or 60 seconds, whichever occurs first. Hull depletion wins a same-step tie. Once finished, stop simulation and input. No escape bonuses, friendly targets, drops, or repeat firing by a surviving attacker.

## Provisional tuning

These are starting playtest values, not evidence of fair balance. Keyboard reticle speed is 225 logical pixels/second in every band; normalize diagonal movement. Pointer placement is direct, as approved for this mode, while all firing paths share one simulation cooldown.

| Difficulty | Attacker speed px/s | Spawn interval s | Projectile speed px/s | Armored chance | Turret cooldown s |
| --- | ---: | ---: | ---: | ---: | ---: |
| Hard | 100 | 1.10 | 210 | 0.25 | 0.42 |
| Medium | 85 | 1.35 | 180 | 0.15 | 0.36 |
| Easy | 70 | 1.65 | 150 | 0.10 | 0.32 |
| Very Easy | 55 | 2.00 | 120 | 0 | 0.28 |

Natural 1 multiplies only the last column by two. Reuse the shared overheat multiplier, but give Space Battle its own tuning table so Asteroid Gunner balance cannot change accidentally.

## Controls, lifecycle, and presentation

- Keyboard: Arrow keys/WASD move the reticle; Space/Enter fires. Holding fires at the shared cooldown. Consume these keys only during active play so menus remain usable.
- Touch: tap/hold/drag the playfield only to aim; these events never fire, queue a shot, or consume cooldown. Tap/hold a separate labeled Fire button to shoot at the retained reticle position, including while another finger aims. Releasing the aiming finger retains the target and does not stop a held Fire action; releasing Fire stops held firing without ending the aiming interaction.
- Mouse: movement aims; primary click/hold or the Fire button fires. Keyboard controls remain as above. Multiple held firing sources combine into one firing action, never additional shots. Fire-button coordinates never change the reticle.
- Retain the last simulation aim after pointer release. Keyboard aim takes control when a movement key is pressed; a subsequent playfield pointer down/move retakes direct aiming. A short tap on a firing control between simulation steps queues one firing attempt; it does not bank a shot across cooldown. Ordinary release preserves an unconsumed quick-tap attempt. Pointer cancellation/lost capture clears that pointer's held/queued action without clearing another pointer's action; pause, blur, visibility loss, and mode changes clear all held/queued actions. Treat capture loss caused by an already handled normal release as part of that release so it does not discard the preserved quick tap.
- Pause freezes threats, flight, telegraph, grace, cooldown, and elapsed time. Focus/visibility loss, including deferred first launch, requires explicit resume. Resume retains reticle position but requires fresh firing input. Retry creates a fresh round.
- Reserve space for the Fire button outside the playfield, using the existing responsive action-rail convention. Prevent playfield/action touch scrolling while retaining normal page scrolling elsewhere. HUD shows time, hull, and raw points; controls, reticle-ready feedback, telegraphs, armor, and projectiles must remain legible on phones.
- Setup and results show the selected check, difficulty, and Natural 1 impairment. Keep all other unavailable combinations visibly disabled. Results support retry and readable/selectable reports; copying the detailed report is optional.

## Scoring and calibration

Raw points = `100 × attackers destroyed + 25 × projectiles intercepted + round(elapsed seconds × 5) + 100 × remaining hull`. An armor hit without a kill awards nothing. Each destroyed/intercepted entity scores once; breaches and threats cleared during grace award nothing. Use fractional seconds before rounding.

Report attackers destroyed, projectiles intercepted, shots fired, damaging hits, breached threats, time, remaining hull, and end reason alongside the existing check/impairment context and GM-boundary statement. Convert raw points to the existing 0–100 advisory rating. Hull failure caps Exceptional at Success without lowering raw points or numeric rating. Players manually share their result; the GM decides all consequences.

The implementation must extend the existing seeded calibration with 288 runs: three profiles × 12 seeds × four difficulty bands × two Natural 1 states. Passive never fires; routine targets the lowest attacker whose center is below y = 168; engaged targets the threat with the shortest estimated time until its bottom edge reaches the defense line. Both active profiles aim directly and hold fire while a target exists; use lowest entity ID to break target ties. Use the script's current seeds, 50 ms stepping, and percentile convention. These profiles are synthetic references, not keyboard or human playtests.

Record observed percentiles and use the new mode's 10th/90th percentiles as its initial fixed anchor pair. If the pair is not strictly increasing, fix the calibration profile/integration before shipping rather than inventing anchors. Add the mode with the next scoring version (v0.5 if v0.4 remains current). Preserve all existing fixed anchors and historical reports. Final acceptance requires Drake's real-run judgments across difficulties and Natural 1, with several completed and failed runs; synthetic calibration cannot establish fairness.

## Implementation handoff and acceptance tests

Keep simulation, tuning, and result calculation in `src/game/rules.ts`; use the established rendering, input, and UI-shell boundaries. Add a distinct Space Battle Gunner state/step/result path and a `space-gunner` score-mode entry. Reuse common types/helpers where appropriate without changing Asteroid Gunner's input contract. Wire the existing Space Battle/Gunner selector only when the mode is implemented. The design PR adds no runtime API/type changes.

The linked implementation issue must require:

- Deterministic tests for attacker spawns/armor, one-time telegraphed firing, interception, nearest-target/tie resolution, one hit per shot, miss cooldown, retained projectiles after source destruction, and same-step player-hit precedence.
- Tests for crossings, simultaneous damage/grace, zero-hull and 60-second endings, terminal-state immutability, and cleanup of removed entities.
- Tests for all difficulty boundaries and twice-normal cooldown on Natural 1 in every band; direct pointer placement/scaling/clamping versus keyboard movement capped at 225 logical pixels/second with diagonal normalization. Do not assert equal reticle speeds across inputs.
- Input acceptance tests: touch aiming alone produces no shots, queued shots, or cooldown consumption; a second finger can tap/hold Fire while aiming; each pointer releases independently; releasing aim retains the target while held Fire continues; releasing Fire stops held firing while aiming continues; Fire-button coordinates do not change aim. Verify keyboard/pointer handoff, quick Fire taps (including normal release/capture-loss ordering), pointer-specific cancellation, pause/background clearing, and one shared cooldown across firing sources.
- Startup/lifecycle tests for deferred launch, focus loss, explicit resume, held-input clearing, retry/mode switching, enabled/disabled choices, correct HUD, complete reports, rating thresholds/failure caps, fractional scores, no double awards, and reproducible calibration.
- `npm test`, `npm run build`, whitespace checks, and attempted rendered desktop/narrow-viewport QA. Real iPhone/iPad Safari touch, rotation, backgrounding, and owner gameplay/balance acceptance remain separate documented gates. Use a draft implementation PR if its required device acceptance is incomplete.

## Boarding Party design sequence

After the Gunner handoff, compare two encounter framings for Pilot, Gunner, Bomber, and Life Support: our crew boards another vessel, or our crew repels boarders. For each role, propose the core activity, input actions, failure/end conditions, and Natural 1 adaptation, and explain how it preserves role ownership. Do not assume ship weapons or their impairments translate unchanged to interior combat.

Neither framing nor any Boarding Party role activity is approved. Drake chooses the framing and approves each activity/impairment before implementation issues are created. Keep #11 open until all five designs have that approval and separate implementation issues; final gameplay signoff belongs to the final owner validation tracker.
