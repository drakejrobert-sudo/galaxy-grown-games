# galaxy-grown-games
A repository for hosting mini games for the galaxy grown campaign. 

## First playable slice

Asteroid Field / Pilot, Gunner, Bomber, and Life Support, plus Space Battle / Pilot, Gunner, Bomber, and Life Support, are implemented as **prototypes awaiting score calibration**. Other situation/role combinations are visibly disabled. Players enter their GM-requested final skill-check total and a separate Natural 1 flag, play independently, and manually share their rating or score. No campaign data or live multiplayer service is included.

Player link: [play.drakesfood.com](https://play.drakesfood.com/). This HTTPS shortlink redirects to the current GitHub Pages deployment and remains the link to share if the underlying hosting URL changes.

### Remaining designs and final acceptance

[Issue #11](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/11) tracks remaining Boarding Party designs and the completed handoff for the [Space Battle Gunner design](docs/space-battle-gunner-design.md) and its separate [implementation issue #38](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/38). Gunner's core turret-defense activity, keyboard/touch/mouse controls, and half-fire-rate Natural 1 are approved; detailed tuning remains provisional. Boarding Party will compare offensive and defensive concepts before Drake approves a framing and each role's activity/impairment. Boarding Party remains unavailable. Space Battle Gunner is implemented here, with final device and gameplay acceptance pending.

[Final owner validation #39](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/39) tracks all 12 situation/role combinations. Each requires Drake's explicit approval of gameplay, all difficulty bands and Natural 1, score/rating balance, real iPhone/iPad Safari, and applicable desktop controls before being marked final. Earlier prototype playtests support that review but do not automatically complete it. Issues #3 and #10 retain their outstanding acceptance work.

### Run locally

Requires Node 22.12+.

```sh
npm ci
npm run dev
npm test
npm run build
```

Open the local URL printed by Vite, including `/galaxy-grown-games/`. If network-interface discovery is restricted in the environment, run `npm run dev -- --host 127.0.0.1`.

### Rules and provisional balance

Each finished run now shows a provisional **0–100 rating** and GM advisory band: 0–24 Setback, 25–49 Mixed, 50–74 Success, and 75–100 Exceptional. A hull, integrity, or fuel failure caps the band at Success while retaining the earned rating and raw points. The modified check and Natural 1 affect gameplay and appear in the report, but do not adjust the rating again. Raw points remain in the manual report. The GM alone determines campaign consequences. See [scoring calibration](docs/scoring-calibration.md) for the reproducible synthetic samples, mode-specific anchors, version, and real-playtest review still needed before thresholds are final.

- Modified totals: <=5 Hard, 6–10 Medium, 11–15 Easy, >=16 Very Easy.
- Natural 1 is an additional impairment, independent of the modified total.
- Pilot engine impairment: **60% normal movement speed**.
- Pilot round: 60 seconds, 3 hull points, and 1.25-second collision grace. Score is rounded survival seconds × 10, plus 100 per remaining hull point; maximum 900.
- Pilot controls: Arrow keys/WASD steer; holding/dragging on the playfield steers toward a destination at the same speed cap. Touch never teleports the ship.
- Gunner impairment: an overheated gun has **double the selected difficulty's cooldown**, producing half its normal sustained rate of fire.
- Gunner round: destroy incoming asteroids before they cross the defense line. Each impact costs one of 3 hull points. Armored asteroids take two hits and are introduced more often on harder difficulties.
- Gunner flies automatically, with scrolling scenery and a weaving ship-mounted turret. Players control only the weapon. Crossing the defense line still costs hull.
- Gunner controls: tap, hold, or drag on touch screens; move the mouse to aim and click or hold to fire on computers. Both use the same Pointer Events path, direct reticle placement, and weapon cooldown; Gunner intentionally does not use keyboard reticle movement.
- Gunner raw score: 100 per destroyed asteroid, rounded survival seconds × 5, and 100 per remaining hull point. Its points are converted to the common rating; raw totals are not directly comparable across modes.
- Bomber follows an automatic flight course while pursuing asteroids travel upward. Time mine releases with Space/Enter or **Drop mine**. Mines always release 34px directly behind the ship, independent of touch, mouse, or keyboard aiming; Asteroid Bomber has no aiming controls.
- Up to 616px viewport width, Bomber keeps the full available canvas width and places Drop mine in a separate row immediately below it. The side rail starts only when the full 480px canvas, 90px rail, 10px gap, and page padding fit; wider touch devices use a compact rail.
- Bomber mines arm after 0.25 seconds, last 5 seconds, and can be placed every 0.65 seconds. Contact detonates a mine and destroys asteroid centers inside its visible blast circle.
- Bomber Natural 1 reduces the mine blast radius by `sqrt(0.5)`, so both the drawn target and collision target have exactly half their normal area. The trigger remains a close-contact fuse.
- Bomber score: 100 per destroyed asteroid, rounded survival seconds × 5, and 100 per remaining hull point. Only direct asteroid–ship collisions cost hull; asteroids that escape off the top are removed without damage or points. Each damaging collision removes one hull point and grants 1.25 seconds of collision grace, including protection from simultaneous hits. The round ends after 60 seconds or when collisions deplete three hull points.
- Life Support routes falling packets through a three-way switch to matching Thrusters, Shields, or Guns bays. Arrow Left/Right or A/D cycles the switch; 1/2/3 selects a bay directly; touch players tap the three labeled bay controls.
- Ordinary power packets match their bay's color and symbol. Heart packets route to Shields and restore one system-integrity point up to a maximum of 5. Overload packets route to Guns and cost two integrity when misrouted; every other mistake costs one.
- Each complete 12-packet cycle normally contains two hearts and one overload. A Natural 1 changes the cycle to one heart and two overloads, exactly halving hearts and adding one overload; an incomplete final cycle is truncated rather than rounded up.
- Life Support score: 100 per correct route, a 50-point bonus for each correctly routed heart or overload, and 100 per remaining integrity point. The run ends after 60 seconds or when integrity reaches zero.
- Space Battle / Pilot starts with 18 seconds of fuel. Fuel drains at one second per second; each collected cell restores 8 seconds, up to a 30-second tank.
- Space Battle enemies cross the field and fire shots aimed at the ship's position when fired. Contact with a ship or shot removes one of 3 hull points, with 1.25 seconds of collision grace.
- Space Battle / Pilot ends after 60 seconds, at zero hull, or when fuel is depleted. Its score is rounded survival seconds × 10, plus 100 per remaining hull point and 50 per fuel cell collected.
- Space Battle / Pilot uses the shared keyboard/touch steering path. A Natural 1 applies the same overloaded-engine impairment: 60% of the selected difficulty's normal movement speed.
- Space Battle / Bomber weaves automatically along the eight-second course. Pursuers enter from behind on straight columns chosen to intercept the ship's predicted position at arrival. A bottom-edge arrow marks each new approach for 0.8 seconds. Pursuers never home, fire, or change lanes; there are no missiles or aiming controls.
- Press Space/Enter or tap **Drop mine** for one mine attempt. Holding never repeats; presses during cooldown are discarded. Mines release 34px directly behind the ship, arm after 0.2 seconds, last 4.5 seconds, and have a 0.85-second cooldown. The aft amber lights, blast preview, cooldown dial, and button text show readiness.
- Natural 1 multiplies mine radius by `sqrt(0.5)`, giving the rendered and collision target half normal area. Ship collisions cost one of 3 hull points with 1.25 seconds of grace; escaping pursuers cause no damage or points.
- Space Battle / Bomber score is 100 per destroyed ship, rounded survival seconds × 5, and 100 per remaining hull point. The run ends after 60 seconds or when hull reaches zero.
- Space Battle / Life Support is a fixed-screen ship-interior platformer. Move with Left/Right or A/D; jump with Up/W/Space. Touch uses Left, Right, and Jump, including simultaneous movement/jump. Land on orange fires from above to stomp them out. Stand grounded within 35px of a blue panel on the same platform for 1.5 seconds to repair it automatically. Its overhead bar fills; moving away or jumping pauses progress without erasing it. Only the nearest eligible panel advances (lowest ID breaks ties). The hazard deadline continues; a completion exactly at the deadline wins. There is no Repair button or repair key.
- Ordinary flames hurt on side/rising contact after a 0.6-second spawn warning; the full valid descending stomp approach stays safe. Electrical panels warn for 0.8 seconds before shooting left/right sparks, first firing one second after appearing. Repair stops future bursts; launched sparks remain dangerous. Sparks, flame contact and overloads share one-integrity damage and 1.25-second grace. Jump or dodge sparks and repair panels while grounded nearby. All new timing values are provisional.
- Uncontained fires cost one of five system-integrity points when their timer expires. Heart pickups restore one integrity, up to five; touching an overload icon costs one, with 1.25 seconds of contact grace. Icon opportunities occur every five seconds: a full 12-opportunity cycle has two hearts and one overload normally, or one heart and two overloads on Natural 1. Other opportunities spawn no icon. The run ends at 60 seconds or zero integrity.
- Space Battle / Life Support raw score is 100 per ordinary fire stomped, 150 per electrical repair, survival seconds × 5 rounded to the nearest point, and 100 per remaining integrity point. Fire spawn interval and lifetime vary by difficulty; all values are provisional playtest tuning.

| Space Battle / Life Support difficulty | Fire spawn interval (s) | Time to contain each fire (s) | Panel burst interval (s) | Spark speed (px/s) |
| --- | ---: | ---: | ---: | ---: |
| Very Easy | 5.2 | 11 | 3.2 | 105 |
| Easy | 4.5 | 10 | 2.8 | 125 |
| Medium | 3.8 | 9 | 2.4 | 145 |
| Hard | 3.2 | 8 | 2.0 | 165 |

- Space Battle / Gunner defends a visible line from attacking ships and their projectiles. Ships fly automatically; Arrow keys/WASD aims at a normalized 225 logical px/s, while touch/mouse aims directly. Touch aiming never fires; tap/hold the separate **Fire** button, including with a second finger. Mouse primary click/hold or Space/Enter also fires. All sources share the same cooldown; released aim is retained, and pause clears held/queued actions.
- Each attacker fires one telegraphed projectile. Armored attackers take two hits; projectiles take one. A turret shot hits the closest target within its tolerance, preferring projectiles then lower entity IDs on exact ties. Destroying the source leaves an already launched projectile intact. Breaches lose at most one hull per step, with 1.25 seconds of protection; runs end at three hull lost or 60 seconds. Natural 1 doubles only the selected band's cooldown.
- Space Battle / Gunner raw points are 100 per attacker destroyed, 25 per projectile intercepted, `round(elapsed seconds × 5)`, and 100 per remaining hull. Its provisional v0.5 rating anchors are 37–5,000 from 288 synthetic runs; older modes retain their anchors. The Fire rail stacks below the full canvas through 632px, allowing for desktop scrollbars at the transition. All tuning and real-device acceptance remain provisional.

- Pause or Escape stops the round. Switching away automatically pauses; resumption is explicit.
- Final reports include the selected role, check total, difficulty, natural-1 impairment, role-specific statistics, raw points, rating, and advisory band. Clipboard failure selects the report for manual copying. GM decides all outcomes.
- All art is original code-drawn geometry. No commercial game assets or GM-only lore are included.

### Architecture

`src/game/rules.ts` owns simulation and scoring. `scene.ts` renders it with Phaser. `input.ts` maps touch/keyboard to shared actions. `main.ts` owns HTML setup, HUD, pause and reporting. This keeps additional situations and roles separate from the shell.

### GitHub Pages

The build targets `/galaxy-grown-games/`. The check workflow runs tests and builds on pushes and pull requests. After a reviewed pull request is merged, the **Deploy game hub** workflow runs on `main`. Its build job repeats `npm test` and `npm run build`, uploads one Pages artifact, and then a separate dependent job deploys that artifact. Keeping deployment separate means retrying a transient deploy failure does not upload a duplicate artifact. The workflow can also be run manually from `main` when Drake explicitly approves that deployment. GitHub Actions must be selected as the Pages source in repository Settings → Pages.

The canonical player-facing shortlink is `https://play.drakesfood.com/`; Drake's Food OpenTofu manages its redirect independently of this Pages workflow.

### Validation status

- Automated tests cover all eight modes, including Space Battle / Life Support platforming, repair actions, icon mix, integrity, scoring, startup, pause, and retry. Run `npm test` for the current count.
- TypeScript check and Vite production build pass. The setup screen defers Phaser until Start challenge. The existing Vite large-chunk advisory remains; see the [measured performance decision](docs/performance-decisions.md).
- A prior desktop in-app Chromium playtest reached results in the original six playable modes, including narrow viewport checks at 390px and 320px. A fixed-height report box clipped wrapped lines; reports now grow to show their full text and reflow on resize. Drake subsequently completed the cross-device playtest and reported that those six modes looked good. See the [issue #12 playtest record](docs/issue-12-playtest.md).
- The detailed score report remains readable, screenshot-friendly, and optionally copyable. Players may report the final rating and band without pasting every statistic; raw points and details remain available for the GM. Cross-mode anchors and bands are provisional pending further real-sample review after [issue #33](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/33).

There are eight playable prototypes. Space Battle Gunner adds turret defense to the seven previously implemented modes; its acceptance record is [issue #38 playtesting](docs/issue-38-playtest.md). Shared setup, controls, manual reporting, and issue #12's cross-device acceptance evidence apply to the original six modes. The new platformer still needs its own real iPhone/iPad Safari playtest before [issue #10](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/10) can close; see the [issue #10 playtest record](docs/issue-10-playtest.md).

### Arcade polish review

[Issue #42 review and first-pass evidence](docs/issue-42-review.md) audits all eight modes and records the Space Battle Gunner/Life Support visual enhancements, desktop timing samples, and pending real-device acceptance. Graphics changes preserve logical dimensions, controls, mechanics, and provisional scoring.

### Development context and review

Read [AGENTS.md](AGENTS.md) for the required branch → pull request → Drake review workflow. Agents never merge or deploy autonomously. See [campaign context](docs/campaign-context.md) for the player-safe setting and role direction, and [ChatGPT project setup](docs/chatgpt-project-setup.md) for reusable project instructions.

For player-facing game changes, the workflow is **implementation → engineering checks → Drake reviews/merges → successful automatic deployment → Drake playtests → issue closure**. Drake can merge reviewed, tested changes to make them available at the player link while gameplay, graphics, controls, and player-facing fix issues remain open for acceptance. Confirm the deployed revision before reporting that a change is live.

Completed engineering work can be ready for PR review with owner playtesting still pending. Drafts are for incomplete work or unresolved engineering blockers. Game-change PRs identify linked issues, engineering validation, remaining owner checks, and a short playtest checklist. Use `Refs #N`; avoid automatic closing references in PR descriptions and commit messages while owner acceptance is pending.

Close a game-change issue only after Drake explicitly accepts the affected changes and its remaining acceptance criteria are satisfied. Record acceptance, the tested revision, and applicable device/control coverage in the issue or a linked playtest record. Merge, deployment, tests, and partial positive feedback alone do not prove full acceptance; desktop/emulated QA does not establish actual iPhone/iPad Safari acceptance. Documentation and CI-only issues may close after review and applicable checks. Historical evidence and existing issue/PR states are preserved.

### Proposed pilot balance update

All four difficulties now have faster, more frequent asteroids, inward diagonal drift, and occasional side-entry hazards with a 1.1-second edge warning. Harder settings add more cross-traffic and modestly reduce steering speed. Natural 1 still multiplies the selected speed by 0.6.

| Difficulty | Asteroid base speed (px/s) | Spawn interval (s) | Ship speed (px/s) | Side-entry chance |
| --- | ---: | ---: | ---: | ---: |
| Very Easy | 115 | 0.74 | 260 | 10% |
| Easy | 150 | 0.56 | 250 | 20% |
| Medium | 190 | 0.40 | 235 | 32% |
| Hard | 235 | 0.28 | 220 | 45% |

Visual additions use original procedural geometry: layered nebulae, parallax stars, a distant planet, rotating cratered asteroids with trails, a paneled ship with twin animated engines, and a collision-grace shield ring. Current balance still needs human playtesting, especially Hard with Natural 1 on touch screens.

### Proposed gunner balance

Harder checks send faster, more frequent hazards and introduce more two-hit armored asteroids. Easier bands also provide a shorter base weapon cooldown. Natural 1 doubles the listed cooldown without changing the selected difficulty.

| Difficulty | Asteroid base speed (px/s) | Spawn interval (s) | Fire cooldown (s) | Armored chance |
| --- | ---: | ---: | ---: | ---: |
| Very Easy | 110 | 1.10 | 0.28 | 0% |
| Easy | 135 | 0.90 | 0.32 | 10% |
| Medium | 160 | 0.72 | 0.36 | 18% |
| Hard | 190 | 0.55 | 0.42 | 30% |

Gunner balance, scoring, target tolerance, and armor frequency are provisional playtest values. Visual feedback includes an aim reticle, weapon-ready color, laser pulse, armored-health pips, a defense line, and impact flash.

### Proposed Space Battle pilot balance

Harder checks send faster, more frequent enemy ships; shorten their firing interval; speed up their shots; and provide fuel less often. Harder settings also modestly reduce steering speed. Natural 1 still multiplies the selected speed by 0.6.

| Difficulty | Enemy speed (px/s) | Enemy spawn (s) | Fire interval (s) | Shot speed (px/s) | Fuel spawn (s) | Ship speed (px/s) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Very Easy | 85 | 2.20 | 1.80 | 155 | 2.6 | 255 |
| Easy | 105 | 1.80 | 1.50 | 180 | 3.0 | 240 |
| Medium | 125 | 1.45 | 1.25 | 205 | 3.4 | 225 |
| Hard | 145 | 1.15 | 1.00 | 230 | 3.8 | 210 |

Space Battle fuel timing, enemy pressure, collision tolerance, and scoring are provisional playtest values. The mode still needs human playtesting on touch and desktop controls, especially Hard with Natural 1.

### Proposed Space Battle bomber balance

Harder checks send faster pursuing ships more frequently and retain the same automatic flight course. Mine cooldown stays consistent across difficulty bands; Natural 1 independently halves the mine blast target area.

| Difficulty | Enemy speed (px/s) | Pursuer spawn (s) |
| --- | ---: | ---: |
| Very Easy | 105 | 1.90 |
| Easy | 130 | 1.55 |
| Medium | 155 | 1.28 |
| Hard | 180 | 1.05 |

Enemy pressure, 58px mine radius, weapon cadence, collision tolerance, and scoring are provisional playtest values. Real-device testing should confirm that individual mine taps are reachable and intercept timing is readable, especially on narrow iPhone screens. Ratings need fresh owner calibration for mine-only gameplay.

### Proposed Asteroid Field bomber balance

Harder checks send faster, more frequent pursuing asteroids with stronger inward drift. Bomber automatic course and mine cadence stay consistent across difficulties, while a Natural 1 halves the mine target area independently of the selected difficulty.

| Difficulty | Asteroid speed (px/s) | Spawn interval (s) | Inward drift |
| --- | ---: | ---: | ---: |
| Very Easy | 115 | 1.12 | 0.28 |
| Easy | 140 | 0.92 | 0.38 |
| Medium | 170 | 0.74 | 0.48 |
| Hard | 200 | 0.58 | 0.58 |

Bomber hazard pressure, blast radius, mine cadence, scoring, collision tolerance, and the 1.25-second collision grace are provisional playtest values. Hold Space/Enter or Drop mine to drop mines directly behind the ship. Mine lifetime dials, ready lights on the ship’s mine racks, and a cyan collision-grace ring provide feedback. All five playable modes share corner hardware and consistent HUD/playfield widths (Bomber includes its reserved control rail on wide screens). The mode still needs human playtesting on touch and desktop controls, especially mine timing as the ship sweeps across the field.

### Proposed Asteroid Field Life Support balance

Harder checks shorten the time between packets and move each packet down the conduit faster. Packet type cycles, integrity effects, and scoring stay consistent across difficulties; Natural 1 changes the special-packet mix independently of the selected difficulty.

| Difficulty | Packet speed (px/s) | Spawn interval (s) |
| --- | ---: | ---: |
| Very Easy | 96 | 1.28 |
| Easy | 110 | 1.06 |
| Medium | 126 | 0.88 |
| Hard | 142 | 0.72 |

Life Support packet timing, five-point integrity pool, two-damage overload mistakes, special-packet bonuses, and scoring are provisional playtest values. The mode still needs human playtesting on touch and desktop controls, especially symbol readability and switch timing at Hard with Natural 1.

### Bomber refinement playtest checklist

Automated regression coverage verifies safe escapes and near misses in all four bands with/without Natural 1, simultaneous collision protection, grace expiry, and later damaging hits. `npm test` passes 37 tests; `npm run build` passes with the existing Phaser bundle-size advisory. The connected preview browser returned `net::ERR_BLOCKED_BY_CLIENT` for the local Vite address; rendered appearance, console health, and real-device interactions are not verified for this refinement.

- On iPhone/iPad Safari and desktop, hold the mine action while the ship flies automatically, let asteroids escape, and confirm only ship collisions reduce hull.
- Check the protection ring after a hit, mine lifetime dials, and the smaller Natural-1 blast circle; confirm pause freezes their timing and explicit resume continues it.
- Check all five playable modes in portrait/landscape: aligned HUD and canvas, readable scores/fuel, reachable Pause, and unobstructed mine/routing controls. Include widths around 616px for the Bomber rail transition.
- Complete a run, inspect/copy the result report, and retry. Assess whether collision-only damage is now too forgiving before adjusting hazard pressure or score values.

### Automatic flight for weapon stations

Bomber and Gunner players operate weapons; Pilot players steer. Scrolling scenery represents forward travel. Weapon-station ships weave predictably by `120 * sin(elapsed * PI / 4)` pixels around center, without reacting to targeting input. The course now completes a full cycle in eight seconds (formerly about 50 seconds), and weapon-station stars pass at 110–200px/s with light streaks. The course is provisional playtest tuning. Difficulty bands, weapon cooldowns, hazard pressure, natural-1 effects, hull rules, and GM reporting remain unchanged.

- Asteroid Bomber shows an amber mine blast preview fixed behind the ship. Mines release there, stay at their drop location as the ship moves on, arm after the existing delay, and detonate on contact. Players time releases; they cannot place mines remotely.
- Space Battle Bomber shows an amber mine preview fixed behind the ship and brief bottom-edge pursuit markers. The blast preview uses the exact same natural-1 radius as damage.
- Gunner retains direct touch/mouse firing, armor, and defense-line mechanics. Its enlarged armored ship has vented engine pods, twin rotating barrels, cooling bands, recoil, muzzle flashes and impact sparks. Extra detail uses bounded procedural drawing without new assets.
- Pause freezes the course, targets, projectiles, and cooldowns. Resume clears held/queued actions while retaining the simulation’s target. Retry resets the flight and targets.

For current validation of the simplified Space Battle stations, see [station simplification playtest](docs/space-battle-stations-playtest.md). Older playtest records describe the controls at the time of those runs. Owner acceptance still requires iPhone/iPad Safari and gameplay/rating review; successful builds and desktop fixtures do not establish those gates.

The [Life Support hazard pass](docs/issue-42-life-support-hazards.md) records sparks/fire-contact behavior and its historical validation. A rating of 100 reaches a provisional points threshold; it does not certify a flawless run.
