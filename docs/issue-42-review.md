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
