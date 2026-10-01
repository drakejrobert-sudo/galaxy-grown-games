# Issue #42 — first arcade polish pass

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
