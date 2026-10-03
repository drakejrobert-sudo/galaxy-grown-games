# Issue #42 — first arcade polish pass

> Historical record: Space Battle Bomber's missile controls and Life Support's Repair action have been replaced. Use [the station simplification checklist](space-battle-stations-playtest.md) for current acceptance; observations below retain their original meaning.

2026-09-30. Parent: [#42](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/42). Implementation base: `c7babcf` (current main when work began). This is the first bounded pass, not completion of the parent issue or final owner acceptance.

## Direction and delivered changes

Keep the existing procedural arcade art: navy metal, mint friendly systems, coral threats, amber armor/warnings, lavender system accents. Preserve the 480×560 logical playfield, physics, input, difficulty, scoring v0.5, and GM boundary. No new artwork downloads, dependencies, audio, or campaign lore.

Space Battle Gunner now uses swept-wing enemy hulls with inset cockpit glass, bevels, engine exhaust, armor plates, and damage scarring. Remaining HP pips still use actual HP. The warning still appears only on an unfired attacker at y ≥ 140; its firing gate remains y ≥ 180. Dark warning backing separates it from the ship and stars. Projectile diamonds retain their original dimensions, with layered trails and a brighter core. Player turret, aim tolerance, weapons, defense line and rules are unchanged.

Space Battle Life Support gains recessed bulkheads, vents, pipes, metal deck edges and supports, a suited crew member with helmet/backpack/boots and a tucked airborne pose, layered ordinary flames, detailed blue electrical panels, and pickup housings around the existing heart/lightning symbols. Platform top positions, fire sites, repair/stomp rules and contact geometry are unchanged.

Added decorative motion reads simulation elapsed time, so it stops during pause and completed states. A guarded, live `prefers-reduced-motion` query freezes new exhaust/flicker/ember/shield modulation without suppressing hazard visibility or jumping poses. Existing other-mode/background animation is outside this reduced-motion pass.

## Eight-mode audit

The observations below combine source inspection with a desktop launch/render/pause/setup smoke pass for all eight modes. They are not owner ratings of fun, difficulty, or balance. Only the two selected Space Battle renderers changed.

| Mode | Graphics / feedback finding | Controls / pacing review candidate | Disposition |
| --- | --- | --- | --- |
| Asteroid Pilot | Already detailed player ship, cratered hazards, layered space background, edge warnings and grace shield. | Speed-capped destination steering needs owner checks for thumb occlusion and reaction time, especially Hard + Natural 1. | Retain art in this pass; prioritize device evidence before tuning. |
| Asteroid Gunner | Detailed turret and asteroid armor; cooldown reticle and beam already communicate weapon state. | Pointer-only direct aiming/firing is approved. Review target readability and tolerance on small screens; do not add keyboard aim casually. | Future shared effects/reticle consistency pass. |
| Asteroid Bomber | Ship racks, lifetime dials, blast circles and cooldown cues already provide useful feedback. | Mine release timing depends on automatic ship motion. Confirm pursuer readability and reachable action control with owner samples. | Future mine/hazard feedback review; preserve directly-behind releases. |
| Asteroid Life Support | Detailed rotary switch, conduit, subsystem bays and color-plus-symbol packets. | Review routing instruction clarity, packet pressure, and selected-route feedback at phone size. | Future onboarding/contrast pass, not additional decorative density. |
| Space Pilot | Detailed enemy craft, aimed projectile trails, fuel pickups and shared ship art. | Review fuel urgency, shot visibility and speed-capped touch steering on device. | Future fuel/readability pass informed by real runs. |
| Space Bomber | Shared detailed enemy art, missile trails, mine dials and weapon readiness. | Review independent aiming/missile/mine multitouch and forward/pursuer recognition. | Future clarity pass; keep keyboard aim cap and weapon cooldown parity. |
| Space Gunner | Simple triangular attackers lagged behind other Space Battle enemies. Warning and projectile detail were sparse. | Approved aim-only touch + separate Fire; direct mouse/touch and capped keyboard aim. Armor and intercept decisions need real playtests. | Delivered enemy, armor, warning and projectile polish; mechanics unchanged. |
| Space Life Support | Sparse interior and rounded crew block lagged behind the routing station and ship art. | Stomp and grounded repair are intentionally distinct. Review jump/landing readability and simultaneous controls on device. | Delivered interior/crew/hazard/pickup detail; mechanics unchanged. |

### Performance and next priorities

1. **Owner/device controls and gameplay acceptance:** prioritize #39, shared controls #3, and Life Support #10. Gather complete/failed real runs across four bands and Natural 1 before deciding control, pacing or rating changes. Missing evidence is not a confirmed defect.
2. **Frame-pacing investigation:** source caps simulation steps at 50 ms. On sustained slow frames, this can discard elapsed wall time. Measure on slower supported devices before choosing a timestep policy; do not alter it in an art PR.
3. **Shared presentation:** align threat/cooldown/weapon feedback across the six older modes, then revisit onboarding and fuel urgency. Keep role-specific meanings and symbols.
4. **Rendering headroom:** the scene rebuilds one Graphics object each frame. Space Life Support still paints the shared space background before covering it with its interior. Profile/cache static geometry or avoid hidden work only with measured evidence. Do not raise canvas resolution speculatively.

## Validation evidence

- `npm test`: **82/82 passed** (79 existing + 3 renderer regressions). Tests cover frozen simulation-state rendering across all eight modes, finite drawing arguments, balanced canvas transforms, airborne poses at both horizontal edges, repeat rendering while inactive, and a live reduced-motion preference. Existing input/mechanics/calibration/startup tests remain passing.
- `npm run build`: TypeScript/Vite production build passed. Deferred game chunk: 1,238.03 kB minified / 338.56 kB gzip. The existing large-chunk advisory remains enabled. No initial-load art assets were added.
- `git diff --check`: passed.
- Desktop Codex in-app Chromium: all eight modes launched/rendered, paused and returned to setup. No console warnings/errors in the actual game or comparison preview.
- Actual game interactions: Life Support keyboard movement/jump and Repair input attempts; visible airborne crew pose; Gunner keyboard aim/fire and Fire-button input attempts; explicit pause/resume, retry/mode switching, and resize. Life Support produced an integrity-failure report (Very Easy, check 16, Natural 1, 33.3 s, 167 raw points), with successful Copy. Successful rendered repairs/stomps, armor kills/interceptions, and 60-second completion were not established by these short smoke runs; their automated mechanics coverage is separate.
- Matched before/after screenshots use identical frozen 8-second fixtures at 480×560: normal/full/damaged armor, warning, projectiles, beam and grace; ordinary/electrical fires, both pickups and crew. Screenshots are external QA artifacts in the Codex task, not shipped source/assets. Static fixtures verify presentation, not gameplay outcomes.
- Narrow checks use the real shell in measured 320px and 390px Chromium frames after the browser viewport override proved inconsistent. These are layout checks with desktop input, not mobile Safari or multitouch evidence. Added art remains readable; Fire stays below the canvas and Life Support's four controls stay outside it. Frame focus loss also exercised automatic pause, followed by explicit resume.

### Comparable desktop timing samples

Temporary harness outside the checkout, current-main renderer vs changed renderer, same frozen fixtures, 180 continuous repaint frames per sample, default desktop Chromium viewport. Frame interval includes browser scheduling; scene-update time measures command rebuilding and excludes later Canvas rasterization. Timer granularity and this short sample do not justify an FPS guarantee or claims about mobile headroom.

| Mode | Frame median before → after (ms) | Frame p95 before → after (ms) | Scene-update median before → after (ms) | Scene-update p95 before → after (ms) |
| --- | ---: | ---: | ---: | ---: |
| Space Gunner | 8.33 → 8.33 | 8.42 → 8.47 | 0.10 → 0.10 | 0.20 → 0.20 |
| Space Life Support | 8.33 → 8.33 | 8.42 → 8.50 | 0.10 → 0.10 | 0.20 → 0.20 |

No obvious desktop regression in these samples. Full dynamic runs on slower hardware, Safari performance, landscape/rotation, true app switching, and physical simultaneous touch remain manual gates. Reduced motion is regression-tested; browser preference switching was not verified through the available UI.

## Owner playtest checklist

- [ ] Real iPhone and iPad Safari: both modes, portrait/landscape, reachable controls, no accidental scrolling, and new detail readable without hiding threats.
- [ ] Gunner: aim alone, simultaneous aim/Fire, independent release/cancel, mouse and keyboard, normal/full/damaged armor, telegraph/interception, all four bands and Natural 1.
- [ ] Life Support: move/jump, stomp ordinary fire, grounded electrical repair, heart/overload recognition, simultaneous actions, all four bands and Natural 1.
- [ ] Pause, switch apps/tabs, explicitly resume, rotate, retry, finish 60 seconds and fail; read and copy the report without stale actions.
- [ ] Confirm decorative reduced motion and acceptable performance on supported devices; give dated gameplay/presentation acceptance in #39 and retain #10's outstanding gates.

Keep #42 open for the remaining enhancement passes. Drake reviews and merges the PR; this record grants no deployment or final balance approval.

## Pilot and Bomber graphics and clarity pass

2026-09-30. Base: merged `main` at `7198675` (including #43 and #44). Drake selected both Pilot and both Bomber modes, approved graphics/clarity scope, and said Space Battle Gunner and Life Support are good. That records presentation satisfaction for this pass, without inventing device-specific evidence or closing #39/#10.

### Delivered presentation

| Mode | Enhancement disposition |
| --- | --- |
| Asteroid Pilot | Inset ship plating, vents and cockpit highlights; rock facets/fractures inside existing silhouettes; backed side-warning chevrons; layered protection ring. Existing warning gates stay intact. |
| Asteroid Bomber | Shared ship/rock detail, rack vents, consistent fixed mine hardware, hollow unarmed/solid armed cores, lifetime dials, and layered blasts with an exact outer radius. |
| Space Pilot | Shared ship detail, enemy nacelles/panels, backed projectile cores and bracketed fuel canisters centered on their simulation positions. Layered protection ring. |
| Space Bomber | Shared ship/enemy detail, distinct nose/aft racks, missile body/fins, backed forward/pursuer markers, and the same mine/blast language using its own lifetime constants. |

Only `scene.ts` changes at runtime. Physics, input, check bands, cooldowns, automatic flight, rating anchors, report text and 480×560 geometry are unchanged. Shared ship/asteroid detail and reduced-motion background opt in only for Pilot/Bomber. The existing Space Gunner/Life Support renderers and Asteroid Gunner/Life Support output remain intact. Mine previews, deployed blast circles and explosion boundaries use actual state radii, including Natural 1's half-area target.

Pilot/Bomber decorative background travel, engine/shield/pickup/shot modulation and warning flicker respect the live reduced-motion preference. Protected Pilot/Space Bomber ships remain visible instead of blinking in reduced motion. Warning gates, mine arming/expiry, readiness and explosion decay still follow actual gameplay state. Paused/completed state has no independent animation clock. Procedural effects are bounded; no new dependencies, downloaded art, audio or campaign content.

### Validation and evidence

- `npm test`: **100/100 passed** (95 existing + five renderer regressions). Representative frozen states cover all four modes, both Natural 1 states, zero-velocity shot geometry, mine arming/expiry and each lifetime constant, exact preview/deployed/explosion radii, readiness, both enemy directions, fuel centering, transforms, finite geometry, pause/terminal rendering and reduced motion.
- `npm run build` and `git diff --check`: passed. Deferred Phaser runtime: **1,240.97 kB minified / 339.43 kB gzip**; the existing large-chunk advisory remains enabled. No new initial-load artwork.
- Temporary VM comparison against `7198675`: all eight drawing-command comparisons identical for both Gunner and both Life Support modes, with normal/reduced motion and populated representative hazards.
- Desktop Google Chrome via Playwright: twelve actual-shell checks (four modes × 1100/320/390px). Confirmed Pilot keyboard movement and Bomber keyboard mine release; exercised canvas pointer input, missile key/button and mine-button input, explicit pause/resume, synthetic window blur, fresh retry, and report Copy. No horizontal overflow. All twelve copied their reports successfully.
- Completion and hull-failure report paths used deterministic simulation-state fixtures in the running shell, not player-earned 60-second runs. Real simultaneous physical touch, successful live mine/missile hits, fuel collections and owner balance judgments are not established by these checks.
- Matched before/after screenshots were captured and visually inspected for each mode at identical frozen 8.1-second states and 480×560 canvases. Narrow paused-shell screenshots and a live 390px Hard/Natural 1 Space Bomber screenshot were also inspected. External screenshot evidence is provided in the Codex task; temporary harnesses and screenshots are not shipped repository files.
- No page exceptions. The comparison/interaction harness logged a missing `/favicon.ico` 404; its source URL was verified separately. A fresh Hard/Natural 1 smoke run had no failed page responses. No gameplay resource or renderer error was observed.
- Resizing from desktop to 320px while setup hid the existing Phaser parent yielded a zero-sized canvas on the next launch in the harness. Narrow tests therefore used fresh page loads at their target widths. Active-play resize from 390px to 900px passed with a visible canvas. Setup-time resize/rotation remains an unresolved lifecycle follow-up; no shell/scale code changed in this graphics pass.

### Comparable desktop rendering sample

Temporary comparison harness, eight simultaneous frozen Canvas scenes (before/after each mode), **240 samples per scene**. Update time measures drawing-command rebuilding, excluding later rasterization; frame intervals include scheduling. These coarse short desktop samples do not establish mobile rendering headroom or an FPS guarantee.

| Mode | Update median before → after (ms) | Update p95 before → after (ms) | Frame median before → after (ms) | Frame p95 before → after (ms) |
| --- | ---: | ---: | ---: | ---: |
| Asteroid Pilot | 0.10 → 0.10 | 0.20 → 0.20 | 16.70 → 16.70 | 17.10 → 17.10 |
| Asteroid Bomber | 0.10 → 0.10 | 0.20 → 0.20 | 16.70 → 16.70 | 17.20 → 17.20 |
| Space Pilot | 0.10 → 0.10 | 0.20 → 0.20 | 16.70 → 16.70 | 17.20 → 17.30 |
| Space Bomber | 0.10 → 0.10 | 0.20 → 0.20 | 16.70 → 16.70 | 17.30 → 17.30 |

### Owner/device checklist

- [ ] iPhone/iPad Safari portrait/landscape: readable rocks, shots, fuel, warnings and mine cues; reachable controls, smooth rendering, no accidental scroll; rotate during setup and play.
- [ ] Pilot steering with keyboard/touch; Space Pilot collect fuel and evade shots. Both Bomber modes: automatic flight and directly-behind mines; Space Bomber independent aim/mine/missile multitouch and forward/pursuer recognition.
- [ ] All four bands ± Natural 1: compare mine target area, weapon readiness, warnings and protection. Assess presentation without changing score/balance here.
- [ ] Reduced motion; pause/app switch/explicit resume; retry; player-earned full completion and failure; inspect/copy GM report.

Keep #42 open for remaining Asteroid Gunner/Life Support polish and agreed follow-ups. Drake reviews and merges; this pass performs no merge or manual deployment.


## Asteroid Field Gunner targeting and impact polish

2026-10-01. Base: current main at `7b080a7`, including Space Battle Bomber's shorter-launch follow-ups. Parent: #42; owner/device acceptance remains under #39 and shared controls #3.

### Delivered presentation and interfaces

Asteroid Gunner now has an open-center, dark-backed reticle with a lower-semicircle cooldown dial. Progress uses the selected band's actual cooldown, including Natural 1's doubled cooldown. Thin mint corner brackets identify the nearest currently eligible asteroid; the renderer and firing simulation share the pure `gunnerTargetAt` helper. Eligibility remains center distance <= radius + 7, with the nearest center winning and exact ties retaining array order. Brackets show current eligibility, not a guaranteed future hit or aim assistance.

Rocks gain inset facets; armored rocks have amber inset segments, backed filled/empty HP pips and visible fractures after their first hit. These details retain the existing rock silhouette and target geometry.

A nullable `GunnerState.shotFeedback` record stores outcome, impact position, radius and remaining simulation time. Each actual shot replaces it; rejected cooldown attempts do not. Misses show a restrained lavender ripple at the unchanged beam endpoint, surviving armor hits show amber sparks at the target's firing-time position, and destroyed rocks show six bounded fragments. Feedback lasts **0.18 simulation seconds**, a provisional cosmetic value. No new RNG calls, scoring events or collision targets are introduced. The existing beam endpoint remains the aim position.

Asteroid Gunner decoration follows simulation time and freezes during pause/completion. Reduced motion freezes background/exhaust decoration and holds shot-effect geometry static while opacity fades; real hazards, automatic ship movement and cooldown progress remain functional. Changes to shared rendering are gated to Asteroid Gunner. Controls, shell, reports, difficulty bands, automatic course, cooldowns, damage and scoring v0.5 anchors are unchanged. Space Gunner and the other modes retain their renderer output.

### Engineering evidence

- `npm test`: **209/209 passed**, including seven new mechanics/renderer tests. Coverage includes nearest/tied/outside-tolerance targets, all bands with/without Natural 1, armor damage/destruction/misses, firing-time coordinates, cooldown rejection, feedback replacement/expiry, terminal freeze, retry defaults, RNG consumption, edge reticles, actual cooldown fractions, reduced motion, frozen-state rendering, finite geometry and restored transforms. Existing seeded calibration remains unchanged.
- `npm run build`: passed TypeScript and Vite production build. Deferred Phaser runtime: **1,243.05 kB minified / 340.07 kB gzip**. Existing large-chunk advisory remains enabled.
- Temporary base/current simulation comparison: **9,600 step calls** across four bands with/without Natural 1 produced identical state excluding the new cosmetic record, using matched seeded RNG streams. Calls after terminal state were included.
- Temporary drawing-command comparison: **14 fixtures** (seven unaffected modes, normal/reduced motion), with populated representative hazards, matched the base renderer exactly.
- Desktop Google Chrome via Playwright at **1100×1000, 390×1000 and 320×1000**: exercised actual mouse hover/click/hold and emulated-touch tap/hold/drag, aiming, miss/armor-hit/destruction outcomes against controlled hazards, explicit pause/resume, synthetic blur auto-pause, fresh retry, and copied completion/failure reports. No horizontal overflow or application page/console errors observed. The missing favicon response is excluded from application-error counts.
- Completion/failure reports used controlled terminal fixtures, not player-earned full rounds. Hazard fixtures isolated actual pointer firing and outcome behavior; they do not establish human interception skill or balance.
- Matched frozen before/after canvas screenshots and full-shell 320px/390px screenshots were captured and inspected. Reduced-motion canvas output, each distinct shot outcome and an edge-reticle fixture were also inspected. An additional 390px emulated-touch check confirmed three repeated shots while held and no further firing after release. Screenshots and harnesses stay outside the repository and are supplied in the Codex task.
- Bounded desktop sample: **240 paired frozen-renderer paints**, sequential baseline/current per animation frame. Drawing-command rebuild median was about **0.10 ms** and p95 about **0.20 ms** for both. This excludes later Canvas rasterization and does not establish mobile FPS or sustained device performance.
- `git diff --check`: passed.

### Owner playtest checklist and limits

- [ ] Actual iPhone/iPad Safari, portrait/landscape: tap/hold/drag aiming and firing, reachable Pause, readable armor pips/brackets/cooldown and uncluttered effects; check physical touch and smooth performance.
- [ ] All four bands with/without Natural 1: identify misses, first armor hits and destruction; confirm the doubled cooldown's dial matches readiness and the ship remains automatic.
- [ ] Pause, true app switching, explicit resume without stale firing, setup/play rotation, retry, player-earned completion/failure and manual GM report sharing.
- [ ] Reduced-motion preference: restrained feedback remains recognizable while hazards and cooldown cues stay usable.
- [ ] Record tested revision and Drake's gameplay/presentation judgment in #39; keep #42 open for remaining upgrades, including Asteroid Life Support.

Real iPhone/iPad Safari, physical touch, rotation, true app switching, owner balance/presentation acceptance and sustained mobile performance remain unverified. Setup-time resize recovery and rating calibration remain separate follow-ups. Drake reviews and merges; no manual deployment or issue closure is performed.

## Asteroid Field Life Support routing clarity

2026-10-02. Base: main `faae4a6`. Refs #42, #39, #3. This completes the remaining dedicated mode-presentation pass; owner acceptance and the parent's other follow-ups remain pending.

### Current eight-mode disposition

| Mode | Delivered enhancement / remaining review |
| --- | --- |
| Asteroid Pilot | Ship/rock/warning/protection polish in #45; real-device steering and fairness acceptance pending. |
| Asteroid Gunner | Targeting, armor, cooldown and outcome polish in #51; physical touch and owner acceptance pending. |
| Asteroid Bomber | Mine/ship/hazard polish in #45; owner timing and device review pending. |
| Asteroid Life Support | This pass: packet recognition, selected routing, instructions and localized outcome feedback; owner readability and routing-pressure review pending. |
| Space Pilot | Fuel/shot/ship polish in #45; owner fuel urgency, steering and rating review pending. |
| Space Bomber | Presentation in #45, current mine-only controls and launcher follow-ups in #47/#49/#50; current device/gameplay acceptance pending. |
| Space Gunner | Hull/armor/warning/projectile polish in #43; real multitouch and owner acceptance pending. |
| Space Life Support | Interior/crew polish in #43, hazards in #44, automatic repair in #47; current device/fairness acceptance and separate rating-saturation review pending. |

### Behavior and interfaces

Power packets use square-corner housings, hearts use rounded housings, and overloads use beveled housings. Larger symbols, dark backing and restrained glows replace busy trails/hardware. The player-selected conduit/bay has a steady light outline and marker; route buttons retain labels, symbols, shortcuts, focus and `aria-pressed` at narrow widths. No next-packet target hint is added.

Guidance outside the canvas explains matching, hearts → Shields, overloads → Guns, integrity consequences and routing at the switch. A fixed-height polite status region describes the latest outcome and actual integrity delta; a full-integrity heart says “Already full.” Mistakes identify the selected and expected bays after arrival. The message persists until the next outcome or retry. Canvas check/cross marks and highlights are localized to the switch and recorded selected bay, replacing the full-playfield flash.

`LifeSupportState.routingFeedback` is nullable cosmetic state: packet kind, expected/selected route, correctness and clamped integrity delta. Arrival processing retains its existing order; the last simultaneous outcome wins. Existing `lastResult` and 0.22-second simulation-time effect lifetime remain. Expiry removes canvas effects without erasing status history. Retry resets history/pressed controls. No new RNG draws, gameplay events or report fields.

Reduced motion freezes the mode's background decoration, panel lights, scanner, packet pulse and selected flow. Packet movement, actual selection and integrity feedback remain functional. Pause/terminal rendering uses frozen simulation state. Inputs, spawn pressure, Natural 1 packet mix, scoring v0.5, live rating anchors, geometry and other modes remain unchanged. No dependencies, artwork downloads, audio or campaign content added.

### Validation

- Automated suite: **214/214 passed**. Added mechanics and renderer regressions plus startup-shell assertions cover ordinary/special successes and mistakes, capped healing/damage, simultaneous arrivals, expiry/history, retry, terminal freeze, selected bays, distinct housings, no broad flash, reduced motion, immutable rendering, finite commands and restored transforms.
- Production TypeScript/Vite build and `git diff --check` pass. Existing deferred Phaser chunk advisory remains enabled; no threshold adjustment.
- Temporary comparison against `faae4a6`: **120,000 step calls**, four bands ± Natural 1 and 12 seeds each. Gameplay state matched excluding cosmetic routing feedback, with identical RNG consumption (1,584 draws); terminal calls included. Existing eight-mode seeded calibration regression passes. These synthetic runs do not establish human balance.
- **14 unaffected renderer fixtures** (seven modes × normal/reduced motion), including populated Gunner armor and Space Life Support pickups, match baseline commands exactly.
- Desktop Chrome at **1100×1100, 390×1100 and 320×1100**: actual mouse/emulated-touch route buttons, number-key selection, arrow cycling, pause/resume and synthetic blur pause, retry, fixture-based healing/mistakes, completed/failed reports and clipboard Copy. No application console/page errors or horizontal overflow. Outcome combinations fit the reserved 66px status region without shifting following controls.
- Before/after canvas, 320px/390px shell and reduced-motion screenshots captured and inspected. Temporary harnesses and screenshots remain outside the repository. Browser state injection and a response-only QA getter are harness instrumentation, not shipped code. Terminal reports and isolated arrivals are fixtures, not player-earned full rounds.
- **240 paired frozen-renderer paints**: command-rebuild medians rounded to 0ms at Chrome timer granularity; both p95 approximately 0.1ms. Excludes later Canvas rasterization and does not establish mobile FPS or sustained device headroom.

### Remaining owner checks

- [ ] Actual iPhone/iPad Safari portrait/landscape: recognize power/heart/overload packets, selected bay, outcome and symbols; reach all buttons and Pause; assess performance and reduced motion.
- [ ] Four bands ± Natural 1: route packets with physical touch and desktop controls; judge readability and fairness without assuming synthetic calibration is acceptance.
- [ ] True app switching, explicit resume, setup/play rotation, retry, player-earned completion/failure and manual GM sharing; record revision and Drake's judgment in #39.

Setup-time resize recovery, frame-pacing investigation, rating recalibration and issue-checklist cleanup remain separate follow-ups. Keep #42/#39/#3 open. Drake reviews and merges; this PR does not merge or manually deploy.

## Playfield resize recovery

2026-10-02. Base: current main at `755041e`, including merged Asteroid Gunner #51 and Asteroid Life Support #52. Refs #42, #3, #39. This resolves the setup-time resize recovery follow-up; performance and rating investigations remain separate.

### Reproduction and fix

Desktop Chrome baseline: launch at 1100px, pause, return to setup, resize to 320px, wait for Phaser's hidden-parent measurements, then launch again. The hidden parent/display widths were both 0. After retry, the parent recovered to 282px but the displayed canvas stayed **0×0**, even after 800ms. Phaser 3.90's `refresh()` computes display size from cached parent bounds before remeasuring them; its later polling sees the already-recovered parent size and does not repair the zero display size.

The shell now measures visible, positive-size parent bounds with `getParentBounds()` before `refresh()` at scene readiness and every reused launch, after role-specific layout is shown. A canvas-container ResizeObserver coalesces notifications into one animation-frame refresh. Both scheduling and execution reject hidden/zero-size containers; leaving play cancels queued work. Retry, mode switching and results keep the same Phaser game. Logical dimensions remain 480×560. Sizing does not change simulation, controls, retained aim, paused status or explicit resume; existing blur/background pause rules remain.

### Validation

- `npm test`: **216/216 passed**. New regression coverage models Phaser's size-before-remeasure behavior with zero cached bounds; checks all eight mode launches/layouts, deferred readiness, one reused game, notification batching, hidden/zero measurements, queued cancellation, paused state, retained crosshair, unchanged input enable calls, results and retry. Existing deferred-loading/background-pause tests remain passing.
- `npm run build` and `git diff --check`: passed. Existing deferred Phaser chunk advisory remains: 1,243.71 kB minified / 340.19 kB gzip. No dependencies or build artifacts are committed.
- Fixed browser reproduction: hidden cache still reaches zero, but retry now produces a **282×329** canvas at the 320px viewport.
- Desktop Google Chrome via bundled Playwright (Browser plugin unavailable): **98 layout checks** across all eight modes at 1100px, 320px and 390px; setup resize/retry, active and paused resizing, results resize/retry, and Space Gunner → Pilot switching. Verified nonzero canvas bounds, logical size/aspect ratio, parent fit, no horizontal overflow, one reused game, frozen paused state and explicit resume. Bomber and Space Gunner control-rail checks include widths 615/616/617/631/632/633/650px with visible, horizontally reachable action buttons.
- **12 mouse mapping checks**: both Pilot and Gunner modes at 320/390/1100px after resizing; actual mouse events mapped the selected rendered canvas location to its expected logical coordinates.
- **15 emulated-touch mapping checks**: both Pilot/Gunner modes and Space Bomber at 320/390/1100px after hidden setup resize/retry. Actual Chrome touch events checked steering, aim/fire versus aim-only, and Bomber aim coordinates. Simulation was temporarily frozen by the external harness for these input inspections; physical touch and gameplay skill are not established.
- Intended page title/content, no Vite error overlay, and no application console/page errors verified in the desktop loop. Full-shell 390px paused Space Gunner and 320px emulated-touch Asteroid Gunner screenshots captured and inspected. Harnesses, response-only QA getters and screenshots stay outside shipped source.
- Results checks use controlled terminal-state callbacks, not player-earned complete rounds. Real Safari, physical touch, true app switching, sustained mobile performance and owner acceptance remain unverified.

### Owner playtest checklist

- [ ] Actual iPhone/iPad Safari: launch, pause/back to setup, rotate portrait ↔ landscape, retry and switch each station; canvas remains visible, fitted and correctly targeted.
- [ ] Rotate during active and paused play, including Bomber/Space Gunner action-rail changes. Pause remains paused until explicit resume; controls remain reachable without accidental scrolling.
- [ ] Complete/fail real runs, rotate on results, return to setup and retry; manually share the GM report.
- [ ] Record tested revision and Drake's acceptance in #39. Keep #42/#3/#39 open; Drake reviews and merges the PR.


## Frame-pacing investigation — 2026-10-03

Tested base: `996cef1` (merged #53). Refs #42, #3, #39. **96 browser samples / 57,678 active updates** show no loss at the rules cap on this desktop. One **316.6 ms raw frame** was filtered by Phaser to **16.67 ms**, losing approximately 300 ms before the rules ran. Controlled slow-frame cases confirm both timing layers. This documentation-only pass changes no production timing, inputs, scoring, dependencies or APIs.

### Measurement method

Chrome 154.0.8037.93, headless desktop ARM64 macOS; Node 22.19.0, Phaser 3.90.0 and Vite 7.3.6. Browser plugin unavailable; bundled Playwright used. External unminified production build served at localhost:5184/galaxy-grown-games/. The normal minified production build is validated separately. These results do not measure the live deployed bundle, physical Safari or mobile rendering headroom.

Eight modes × widths 1100/390 × CPU rates 1/4 × three samples, each at least 10,000 ms of active raw rAF time. Sequential contexts avoid simultaneous game workloads. Height 1100, desktop device scale factor 1, no mobile emulation in the timing matrix. Hard/check 5, Natural 1 off, default motion preference. The controlled matrix separately covers all bands and Natural 1. Wait for Phaser's 120-frame startup cooldown; omit loading/setup/paused intervals. Continue a mode across samples, retry via the real shell when it ends, and reset interval continuity at retries. Warmup deaths precede samples and are excluded from their retry counts.

Every 500 ms scripted keyboard events alternate Pilot left/right every 2 seconds, press Bomber Space, cycle Asteroid Life routes and alternate Space Life movement with a jump every second. Gunner uses real Playwright mouse down per launch, then synthetic mouse aim moves toward the lowest current target. This creates repeatable control workloads, not player skill or physical touch evidence. Random hazards are unseeded in live browser samples. The deterministic VM checks use seed 42 separately.

The browser intercepts only the index JS response to append a read-only getter for the existing scene/game; no checkout or build file is rewritten. Wrap existing scene update, paint and HUD callbacks with performance.now(), invoking each original once with its original receiver/arguments. Phaser caches scene.update at boot: assign the same observer to scene.sys.sceneUpdate. Read input only through the original update. Record game.loop.rawDelta (rAF timestamp interval), delivered delta, change in selected state's elapsed, total update duration, paint duration and HUD callback duration. Also record performance.now() arrival intervals. Do not add Math.random calls. Buffer rows in memory and extract outside measured update execution.

Timer granularity is approximately 0.1 ms. Update includes simulation, HUD, command-building and wrapper overhead; paint measures Graphics command rebuilding, not later Canvas rasterization/compositing. HUD includes synchronous DOM writes; deferred layout/paint can happen afterward. Quantiles are pooled across three samples per configuration. Signed Phaser gap = raw minus delivered; it can be negative at a sample boundary as smoothing redistributes time. Rules cap loss excludes terminal frames; round-end clipping is reported separately. Small floating-point differences round to zero.


### Live browser measurements

Each row pools three active-play samples. Width/CPU is CSS viewport width and requested CDP CPU rate. Frames/retries excludes warmup retries. Timing cells are **median/p95 milliseconds**; values rounded to zero are below timer resolution, not free work. Raw is the rAF timestamp interval; arrival is the observer's performance.now() interval (first update of each active segment excluded). These are scheduling observations, not measurements of screen presentation. Update includes HUD and paint; do not add these columns together. CPU-throttled timings must not be interpreted as an improvement: contexts ran in fixed order, JIT/scheduling differ and timer precision is coarse; this is not a randomized paired optimization benchmark.

| Mode | Width/CPU | Frames/retries | Raw | Arrival | Delivered | Update | HUD | Paint commands | >50 ms raw/delivered |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- | ---: |
| Asteroid/Pilot | 1100/1× | 1803/4 | 16.7/16.7 | 16.7/16.8 | 16.67/16.67 | 0.3/0.4 | 0/0.1 | 0.2/0.3 | 0/0 |
| Asteroid/Gunner | 1100/1× | 1803/5 | 16.7/16.8 | 16.7/17.9 | 16.67/16.67 | 0.3/0.4 | 0/0.1 | 0.2/0.3 | 0/0 |
| Asteroid/Bomber | 1100/1× | 1803/1 | 16.7/16.7 | 16.7/18.3 | 16.67/16.67 | 0.3/0.4 | 0/0.1 | 0.2/0.3 | 0/0 |
| Asteroid/Life Support | 1100/1× | 1803/3 | 16.7/16.7 | 16.7/17.4 | 16.67/16.67 | 0.3/0.4 | 0.1/0.1 | 0.2/0.3 | 0/0 |
| Space Battle/Pilot | 1100/1× | 1803/3 | 16.7/16.8 | 16.7/18.4 | 16.67/16.67 | 0.4/0.5 | 0/0.1 | 0.3/0.4 | 0/0 |
| Space Battle/Gunner | 1100/1× | 1803/1 | 16.7/16.7 | 16.7/17.2 | 16.67/16.67 | 0.3/0.4 | 0/0.1 | 0.2/0.3 | 0/0 |
| Space Battle/Bomber | 1100/1× | 1803/2 | 16.7/16.7 | 16.7/17.6 | 16.67/16.67 | 0.4/0.6 | 0/0.1 | 0.3/0.4 | 0/0 |
| Space Battle/Life Support | 1100/1× | 1803/1 | 16.7/16.8 | 16.7/16.9 | 16.67/16.67 | 0.3/0.4 | 0/0.1 | 0.2/0.3 | 0/0 |
| Asteroid/Pilot | 1100/4× | 1803/4 | 16.7/16.7 | 16.7/17.4 | 16.67/16.67 | 0/0.3 | 0/0.1 | 0/0.2 | 0/0 |
| Asteroid/Gunner | 1100/4× | 1803/5 | 16.7/16.8 | 16.7/18.2 | 16.67/16.67 | 0/0.5 | 0/0.1 | 0/0.3 | 0/0 |
| Asteroid/Bomber | 1100/4× | 1803/0 | 16.7/16.7 | 16.7/17.8 | 16.67/16.67 | 0.1/0.4 | 0/0.1 | 0/0.3 | 0/0 |
| Asteroid/Life Support | 1100/4× | 1803/3 | 16.7/16.8 | 16.7/18.3 | 16.67/16.67 | 0.1/0.4 | 0/0.1 | 0/0.2 | 0/0 |
| Space Battle/Pilot | 1100/4× | 1803/3 | 16.7/16.8 | 16.7/17.4 | 16.67/16.67 | 0.1/0.5 | 0/0.1 | 0.1/0.4 | 0/0 |
| Space Battle/Gunner | 1100/4× | 1803/1 | 16.7/16.7 | 16.7/18.3 | 16.67/16.67 | 0/0.3 | 0/0.1 | 0/0.3 | 0/0 |
| Space Battle/Bomber | 1100/4× | 1803/3 | 16.7/16.7 | 16.7/18.1 | 16.67/16.67 | 0.1/0.4 | 0/0.1 | 0/0.3 | 0/0 |
| Space Battle/Life Support | 1100/4× | 1803/1 | 16.7/16.8 | 16.7/17.7 | 16.67/16.67 | 0/0.4 | 0/0.1 | 0/0.3 | 0/0 |
| Asteroid/Pilot | 390/1× | 1803/4 | 16.7/16.8 | 16.7/16.8 | 16.67/16.67 | 0.3/0.4 | 0/0.1 | 0.2/0.3 | 0/0 |
| Asteroid/Gunner | 390/1× | 1803/5 | 16.7/16.7 | 16.7/18.2 | 16.67/16.67 | 0.2/0.4 | 0/0.1 | 0.2/0.3 | 0/0 |
| Asteroid/Bomber | 390/1× | 1785/1 | 16.7/16.7 | 16.7/17.5 | 16.67/16.67 | 0.3/0.4 | 0/0.1 | 0.2/0.3 | 1/0 |
| Asteroid/Life Support | 390/1× | 1803/4 | 16.7/16.8 | 16.7/17.1 | 16.67/16.67 | 0.3/0.4 | 0/0.1 | 0.2/0.3 | 0/0 |
| Space Battle/Pilot | 390/1× | 1803/3 | 16.7/16.8 | 16.7/17.2 | 16.67/16.67 | 0.4/0.5 | 0/0.1 | 0.3/0.4 | 0/0 |
| Space Battle/Gunner | 390/1× | 1803/1 | 16.7/16.7 | 16.7/17.3 | 16.67/16.67 | 0.3/0.4 | 0/0.1 | 0.2/0.3 | 0/0 |
| Space Battle/Bomber | 390/1× | 1803/2 | 16.7/16.7 | 16.7/16.9 | 16.67/16.67 | 0.4/0.5 | 0/0.1 | 0.3/0.4 | 0/0 |
| Space Battle/Life Support | 390/1× | 1803/2 | 16.7/16.7 | 16.7/17.2 | 16.67/16.67 | 0.3/0.4 | 0/0.1 | 0.2/0.3 | 0/0 |
| Asteroid/Pilot | 390/4× | 1803/4 | 16.7/16.7 | 16.7/17.6 | 16.67/16.67 | 0.1/0.5 | 0/0.1 | 0/0.4 | 0/0 |
| Asteroid/Gunner | 390/4× | 1803/5 | 16.7/16.8 | 16.7/17.3 | 16.67/16.67 | 0.1/0.4 | 0/0.1 | 0/0.3 | 0/0 |
| Asteroid/Bomber | 390/4× | 1803/0 | 16.7/16.7 | 16.7/17.5 | 16.67/16.67 | 0.1/0.4 | 0/0.1 | 0/0.3 | 0/0 |
| Asteroid/Life Support | 390/4× | 1803/3 | 16.7/16.7 | 16.7/17.2 | 16.67/16.67 | 0.1/0.4 | 0/0.1 | 0/0.3 | 0/0 |
| Space Battle/Pilot | 390/4× | 1803/2 | 16.7/16.7 | 16.7/17.3 | 16.67/16.67 | 0.1/0.6 | 0/0.1 | 0.1/0.4 | 0/0 |
| Space Battle/Gunner | 390/4× | 1803/1 | 16.7/16.8 | 16.7/17.2 | 16.67/16.67 | 0.1/0.5 | 0/0.1 | 0/0.3 | 0/0 |
| Space Battle/Bomber | 390/4× | 1803/2 | 16.7/16.7 | 16.7/17.3 | 16.67/16.67 | 0.1/0.6 | 0/0.1 | 0.1/0.5 | 0/0 |
| Space Battle/Life Support | 390/4× | 1803/1 | 16.7/16.8 | 16.7/17.9 | 16.67/16.67 | 0.1/0.5 | 0/0.1 | 0/0.4 | 0/0 |

Across the full matrix: **961.561 s raw active time**, approximately **961.258 s delivered and simulated time**, **one raw interval >50 ms**, **zero delivered intervals >50 ms**, and **80 in-sample retries**. Phaser's signed raw-minus-delivered difference totals **303.34 ms**; all but the outlier configuration have combined differences between −0.16 and +0.26 ms. The sum of positive rules-cap residuals is below 0.000001 ms (floating-point error). There is no material terminal-round clipping in these samples.

| Width/CPU (all eight modes) | Raw active (s) | Delivered (s) | Simulated (s) | Signed Phaser gap (ms) | Rules loss, nonterminal (ms) | Terminal clipping (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1100/1× | 240.391 | 240.389 | 240.389 | 1.12 | 0.00 | 0.00 |
| 1100/4× | 240.391 | 240.390 | 240.390 | 0.90 | 0.00 | 0.00 |
| 390/1× | 240.390 | 240.090 | 240.090 | 300.38 | 0.00 | 0.00 |
| 390/4× | 240.390 | 240.389 | 240.389 | 0.94 | 0.00 | 0.00 |

The outlier was **Asteroid Bomber, 390px, 1× CPU, sample 1**: 583 active updates, 10,016.4 ms raw time, 9,716.283 ms delivered/simulated time, 300.117 ms net Phaser gap. At that interval: raw and arrival approximately 316.6 ms, delivered/simulation 16.67 ms, observer update 0.2 ms, HUD 0.1 ms and paint 0.1 ms. Adjacent updates cost 0.1–0.3 ms. No source cause for the stall is established; it could reflect browser/host scheduling or work outside the measured update. Keep this sample rather than removing the outlier. Phaser filtering explains the time loss; measured command rebuilding does not explain the stall.

Pooled update p95 spans 0.3–0.6 ms, HUD p95 0.1 ms and command-building p95 0.2–0.5 ms. The largest update was 11.7 ms, including an 11.5 ms terminal HUD/results callback, in desktop Pilot; maximum command-building duration was 1.5 ms. No sustained CPU-side command-building or HUD bottleneck is established. Canvas rasterization/compositing and slower supported hardware remain unmeasured.

### Source findings

FlightScene.update passes Phaser's delivered delta/1000 once to the selected rule function, once to the existing HUD callback, then rebuilds Graphics. Every rule function caps nonnegative dt at 0.05 and remaining round time. Thus direct 100 ms scene updates advance 50 ms; direct 250 ms updates advance 50 ms. The loss is persistent: no accumulator or subsequent catch-up exists.

Phaser default smoothStep is true, deltaHistory 10, target 60 FPS, min 5 FPS (200 ms cutoff), panicMax 120. During startup/focus cooldown, raw delta is limited to the target interval. After cooldown, raw intervals above 200 ms are replaced by a history slot before the 10-frame average. A single 250 ms stall therefore need not deliver 250 ms to the scene. A substep loop using only smoothed delta would not recover time already filtered by Phaser.


### Controlled timing and observer checks

Run the actual scene/rules with a no-op Graphics adapter and seed 42. Compare uninstrumented and identically instrumented scenes after every update: all eight state objects, RNG draws/final seed, input-read counts and HUD callback counts. **320 paired runs and 320,337 active updates passed**: eight modes × totals 5/10/15/16 × Natural 1 off/on × five cadence scenarios. Inputs are deterministic held movement/firing, periodic mine/jump attempts and route/aim changes; they are synthetic, not browser/device controls. Each run stops at its first terminal state. Pause at update 60 advances no state and reads no input; three further terminal updates leave state, RNG and reads unchanged.

| Direct scene-update scenario | Configurations | Rules cap loss |
| --- | ---: | --- |
| Steady 16.67 ms | 64 | Zero, excluding normal final-round clipping |
| Steady 33.33 ms | 64 | Zero, excluding normal final-round clipping |
| Steady 50 ms | 64 | Zero, excluding normal final-round clipping |
| Steady 100 ms | 64 | 50 ms per update; total 6.9–60.05 s until terminal, depending on run |
| 16.67 ms with one 250 ms update at index 120 | 64 | Exactly 200 ms per run; no later catch-up |

These direct scene updates bypass Phaser so the rules layer can be isolated. To isolate Phaser separately, extract and execute the installed 3.90.0 TimeStep.smoothDelta function with its real defaults (10 initial history slots of 16.667 ms, min cutoff 200 ms, in focus). Below uses 300 raw intervals; all steady scenarios begin with cooldown already zero. The initial history causes the reported transition gap; the final delivered delta shows steady state.

| Raw scenario | Raw time (s) | Delivered (s) | Capped simulation budget (s) | Phaser gap (ms) | Rules budget loss (ms) | Last/stall delivered (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 300 × 16.67 ms | 5.001 | 5.001 | 5.001 | 0.015 | 0 | 16.67 |
| 300 × 33.33 ms | 9.999 | 9.924 | 9.924 | 74.985 | 0 | 33.33 |
| 300 × 50 ms | 15.000 | 14.850 | 14.850 | 150 | 0 | 50 |
| 300 × 100 ms | 30.000 | 29.625 | 14.950 | 375 | 14,675 | 100 |
| 300 × 250 ms | 75.000 | 5.000 | 5.000 | 70,000 | 0 | 16.667 |
| 299 × 16.667 ms + one 250 ms stall at index 120 | 5.233 | 5.000 | 5.000 | 233.333 | 0 | 16.667 |

The isolated stall result also matches when initial cooldown is 120. These are executable algorithm checks, not observed device frame traces. The capped budget column applies min(delivered, 50); it is not a player-earned full game. They show why fixing only the 50 ms cap cannot recover Phaser-filtered time.

### Follow-up proposal (for review, not implemented)

Retain gameplay and renderer behavior for this measurement PR. No caching or HUD rewrite is justified by source density alone. Obtain supported slow-device traces before calling desktop headroom a device pass.

If owner review prioritizes the reproducible time-loss case, make one separate bounded timing PR: use raw active-frame delta rather than Phaser smoothing for simulation; keep existing rule-step guards and integrate up to 250 ms in substeps no larger than 50 ms (maximum five steps). No retained backlog across frames. A raw interval above 250 ms should advance nothing, clear queued/held actions and use the existing pause overlay with a short interruption reason and explicit Resume. 250 ms is a proposed safety threshold requiring owner review, not established balance tuning. Do not change global Phaser smoothStep/render scheduling speculatively.

Separate held input from consumed actions before substeps: held movement/weapon actions continue, but jump, single mine launch, queued quick shot, straight-aft selection and pointer release occur only once. Resolve Space Bomber world-point preview/release against the displayed pre-step rack; retain the resulting aim/range for remaining substeps. Recompute Pilot destination steering from current position through the pure steering path. Keep aim-only Space Gunner touch and all speed/cooldown constraints. A cooldown-rejected one-shot is discarded, never banked.

On pause/background/setup/retry/resume, reset timing continuity and discard any unprocessed time/input; never catch up a hidden-tab interval. On completion/fatal state, stop substeps immediately; notify the HUD/results once and paint once per rendered update. Preserve duration caps, collision ordering/grace and source-owned hazard rules. Normal deltas <=50 ms retain one rule invocation. Larger deltas can change collision, spawn and scoring trajectories versus today's slowed simulation; require seeded comparisons, one-shot regressions and owner/device checks rather than claiming universal FPS-independent equivalence. Leave live anchors and tuning unchanged; review changed outcomes separately.

### Reproduction and evidence retention

External harnesses and raw records are retained locally under /private/tmp/ggg-pacing-evidence, outside shipped source. They are not required for normal development or CI. Use profile.cjs for browser samples, controlled.cjs for paired scene/state checks, phaser-delta.cjs for the installed smoothDelta function and qa.cjs for shell checks. Run summarize.cjs after profiling to pool raw rows. Do not run builds/tests or other benchmark workloads concurrently with profiles. The methodology above specifies the same measurement independently of the local harness lifetime.

From the tested checkout, prepare and serve the external unminified build:

```sh
npm ci
npm run build
node node_modules/vite/bin/vite.js build --minify false --outDir /private/tmp/ggg-pacing-build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5184 --strictPort --outDir /private/tmp/ggg-pacing-build
```

In a separate terminal, using the retained local harnesses:

```sh
node /private/tmp/ggg-pacing-evidence/profile.cjs
node --import ./node_modules/tsx/dist/loader.mjs /private/tmp/ggg-pacing-evidence/controlled.cjs
node /private/tmp/ggg-pacing-evidence/phaser-delta.cjs
node /private/tmp/ggg-pacing-evidence/qa.cjs
node /private/tmp/ggg-pacing-evidence/summarize.cjs
```

Requires Node 22.12+ and the installed tsx loader. The harnesses import bundled Playwright, use installed desktop Chrome and point at the isolated checkout/build paths; adapt those local paths to repeat on another machine. `profile.cjs` resumes existing `profiles.json`, so archive that file and its raw records before a fresh matrix. Only the local evidence directory contains these scripts: they are not published repository tools. Record the new environment and revision. For independent reproduction without that directory, use the observation recipe and input/sample protocol above; instantiate the scene with the no-op Graphics adapter used by `tests/rendering.test.ts`, inject seed-42 RNG into each rule call, and compare every state/read/RNG count after each cadence update until terminal state.


### Validation and owner checklist

- `npm test`: **216/216 passed**; ordinary TypeScript/Vite minified production build passed; `git diff --check` passed before delivery. Existing Phaser large-chunk advisory remains (1,243.71 kB minified / 340.19 kB gzip). No generated builds/dependencies/harnesses/traces are committed.
- Desktop Chrome QA through the external profiling build: all eight modes launched; actual keyboard/mouse and route-button actions changed state; pause froze state across resize to 390px, explicit resume advanced it, synthetic blur required resume, setup resize/retry to 320px recovered positive canvas bounds, mode switching worked and results/Copy were exercised. Page identity, meaningful content, absence of Vite overlay, console/page health and horizontal overflow passed. No application warnings/errors in the completed profiling or QA runs.
- Completed/failed reports used terminal fixtures through the actual callbacks. They are not earned full-round success or owner balance evidence. Live timing samples include natural failures and retries; 390px is desktop layout, not touch emulation. Actual iPhone/iPad Safari, physical multitouch, true app switching, supported-device performance and owner acceptance remain pending. Representative 390px Gunner/Life Support live screenshots and a copied Gunner report were inspected; external screenshots are retained locally.
- A profiling startup wait timed out once before the Space Life samples. A fresh diagnostic launch succeeded without application errors; the harness now brings the page forward and explicitly resumes a paused launch before sampling. Completed sample data was retained. An initial QA assertion read Copy status before its asynchronous callback resolved; waiting for the status fixed the harness check. These are harness corrections, not repository fixes or established gameplay defects.

- [ ] Real iPhone/iPad Safari: all eight modes at supported orientations, sustained play through completion/failure, readable effects, reachable controls and no accidental scrolling; record model, OS, browser and tested revision.
- [ ] Record frame intervals and active-wall versus simulation time on a supported device that feels slow. Preserve raw and delivered deltas separately and mark background/pause boundaries; CPU throttling is not device evidence.
- [ ] All four bands ± Natural 1: judge controls, warning/cooldown fairness and rating outcomes; pause, switch apps, explicitly resume, rotate, retry and manually share a report.
- [ ] Review the proposed timing policy separately before implementation. Keep #42/#3/#39 open for remaining owner acceptance; this PR grants no merge or manual deployment authorization.

## Bounded frame timing implementation — 2026-10-03

Follow-up to the measurement-only PR #54, based on fresh remote `main` at `40bb312f831f43377639ec8d6cebe8e0d85fc905`. The tested implementation revision is `aab39d9` (the subsequent documentation commit changes only this report). Drake selected explicit pause for active frame gaps greater than 250 ms. This is a gameplay/lifecycle change awaiting PR review and owner/device acceptance.

### Implemented policy

- Simulation reads Phaser 3.90's `game.loop.rawDelta`, before delivered-delta smoothing. Rendering configuration and each rule's defensive 50 ms cap remain unchanged.
- Positive, finite active intervals through 250 ms advance fully in successive steps of at most 50 ms, at most five steps per frame. There is no accumulator or deferred backlog. Invalid/nonpositive intervals do no simulation work.
- An interval greater than 250 ms advances nothing and enters the existing explicit pause flow, clears held/queued controls, and displays “Play paused after an interruption. Resume when ready.”
- Launch, retry, mode change and pause/resume reset timing continuity. The first active update establishes continuity without state advancement or input consumption; this deliberately excludes the boundary interval rather than counting pre-launch/paused time.
- Queued actions are sampled once. Quick shots, jumps, Space Bomber presses/releases and queued straight-aft resets apply only on the first substep; a cooldown-rejected attempt is discarded. Continuing substeps retain supported held movement, aim and weapon controls. Space Bomber launches remain single attempts even while the button/key is held.
- Pilot touch direction is recalculated from the current position on each substep using the existing pure input read. Space Bomber pointer coordinates are interpreted once against the rack displayed before advancement; subsequent steps retain angle/range and applicable held keyboard controls.
- Terminal state stops remaining substeps immediately. HUD/results publish once per advancing frame, including its terminal frame; painting runs once per update. Rule state layouts, tuning, geometry, scoring anchors, difficulty/Natural 1 and dependencies are unchanged.

### Before/after evidence

The pre-change direct-scene baseline below is the controlled measurement recorded above, independent of Phaser filtering. Post-change values were also checked through the actual browser scene at both 1100 px and 390 px in every mode, with delivered delta deliberately set to 1 ms to verify it is ignored.

| Active raw interval | Old direct scene advancement | New advancement | Disposition |
| --- | --- | --- | --- |
| 16.67 / 33.33 / 50 ms | Full interval | Full interval | One rule step; seeded comparisons pass |
| 100 ms | 50 ms | 100 ms | Two steps; 50 ms loss removed |
| 250 ms | 50 ms | 250 ms | Five steps; 200 ms loss removed |
| 251 ms | At most 50 ms through rules; Phaser could filter earlier | 0 ms | Explicit interruption pause |

Phaser's earlier isolated-250-ms experiment delivered about 16.67 ms after filtering. Using raw delta prevents that particular pre-rules loss as well. Gaps beyond the approved threshold and launch/resume boundary intervals are deliberately excluded, not advertised as recovered time.

### Automated and browser validation

Environment: macOS ARM64; local Node `v25.9.0`; repository-locked Phaser 3.90/TypeScript/Vite/tsx; bundled Playwright with installed headless desktop Chrome `154.0.8037.93`. Temporary browser tooling and screenshots remain outside shipped source under `/private/tmp/ggg-timing-evidence`; the inspected unminified production build is `/private/tmp/ggg-timing-build`. No dependencies were added or updated.

- **234 tests passed**, production TypeScript/Vite build passed, `git diff --check` passed. The pre-existing Phaser chunk-size warning remains.
- **320 seeded comparisons**: eight modes × four totals (5, 10, 15, 16) × Natural 1 on/off × five intervals (16.67, 33.33, 50, 100, 250 ms). Each case runs up to six simulated seconds or terminal state. Scene state, RNG draw count and final seed match direct rules using identical substeps/inputs. Tests verify the five-step limit, positive step sizes, input-read counts, one HUD callback and one paint per advancing frame.
- Additional tests cover the 250/250.001 ms boundary, invalid intervals, startup/resume priming, retry, paused state/input/RNG, all-mode timed completion, fatal Pilot collision, quick versus held shots, cooldown rejection, single Bomber launch/target retention, Pilot touch direction, damage grace, repair progress through pause and one repair award. Existing mechanics, input cancellation, independent ownership, resize and startup regressions remain passing.
- **16 focused browser cases**: all modes at 1100/390 px, normal CPU. Each advances injected 100/250 ms intervals fully, freezes on 251 ms, resumes explicitly without replaying the gap, and pauses after an actual 320 ms main-thread busy stall through Phaser's live loop. These are controlled behavioral checks, not sustained performance benchmarks; the earlier 96-sample performance investigation remains the measurement baseline.
- 390 px context has emulated touch. Chrome DevTools touch events exercise simultaneous Space Gunner aim/Fire, aim-only without shooting, independent Fire release, and a quick Space Bomber launch rejected during cooldown without being banked. Desktop mouse covers that Bomber rejection as well.
- A separate eight-mode browser lifecycle pass exercises sustained applicable controls, manual pause/resize/resume, synthetic window blur, setup/retry at 320 px, mode switching, completion/failure report fixtures and Copy. The fixtures validate reporting paths rather than proving earned gameplay completion.
- Screenshots were captured for active/paused states at both widths and result screens. The eight narrow active screens and narrow interruption overlay were inspected: readable HUD, unobstructed playfield, accessible controls and readable interruption/Resume content. Both browser suites finish with no application errors; the lifecycle suite also rejects console warnings.
- The timing harness required two corrected setup retries: explicitly prime a freshly resumed/launched scene before measuring, and target the Fire touch pointer when releasing one of two CDP touches. Those failed assertions were harness setup errors; the final run passes all 16 cases. Sandbox access was required for local Git metadata, preview-server binding and Chrome launch; no repository permission settings were changed.

Reproduce the committed timing, input and lifecycle coverage from this branch:

```sh
npm ci
node --import tsx --test tests/frame-timing.test.ts tests/frame-input.test.ts tests/startup.test.ts
npm test
npm run build
git diff --check
```

To repeat the external browser checks while their temporary harnesses are retained, use the bundled Playwright package and installed Chrome paths in the harnesses:

```sh
node node_modules/vite/bin/vite.js build --minify false --outDir /private/tmp/ggg-timing-build
node node_modules/vite/bin/vite.js preview --outDir /private/tmp/ggg-timing-build --host 127.0.0.1 --port 5186
# In another terminal:
node /private/tmp/ggg-timing-evidence/qa.cjs
node /private/tmp/ggg-timing-evidence/timing-qa.cjs
```

The harness appends a read-only `window.__qa` getter to the served shell bundle. Controlled interval cases temporarily suppress normal scene updates, set `game.loop.rawDelta`, call the real scene update, and restore the raw value. The real-stall cases restore Phaser's cached scene update and busy-wait for 320 ms. JSON summaries (`qa.json`, `timing-qa.json`) and PNGs remain temporary local evidence, not durable artifacts available to other checkouts. The committed tests provide the durable reproduction of the timing contract.

### Compatibility limits and physical Safari checklist

Raw timing replaces smoothed timing and catch-up applies input over additional simulation steps. Existing trajectories, collision outcomes, hazard pressure and scores can therefore differ during jitter/slow frames despite unchanged numeric tuning. State/RNG equivalence is established only for identical substeps and inputs, not arbitrary frame cadences. Five steps bound the work, but this pass does not establish sustained mobile performance or absence of interruption pauses on slower devices. No rendering cache/HUD rewrite or scoring recalibration is justified by the prior profiles.

Before final acceptance on the merged/deployed revision, record dated evidence separately for an actual iPhone and iPad Safari:

- Play every mode across all four bands and Natural 1. Assess timing, hazard fairness, provisional ratings and whether the 250 ms interruption policy pauses too often.
- Check sustained/quick actions, simultaneous Space Gunner aim/Fire, one-attempt Bomber launches, touch Pilot speed/destination and Life Support jumps/repairs. Pause/resume must retain simulation aim/repair progress and clear stale controls.
- Switch apps/tabs, lock/unlock, rotate, resize/retry and change modes. Hidden time must not advance play; interruptions require explicit resume; playfields must recover visible nonzero bounds.
- Check terminal completion/failure, one result report, readable/copyable scores and accessible pause controls in both orientations.

Desktop CPU throttling, narrow viewports, emulated touch and synthetic blur are supporting evidence only. Physical Safari, human gameplay/score acceptance and Drake's final signoff remain pending. Keep #42, #3 and #39 open; this PR uses `Refs` and authorizes no manual deployment.
