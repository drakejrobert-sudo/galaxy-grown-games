# Boarding Party: cargo cover and shootable airlocks

Drake approved this follow-up on 2026-11-06. It supersedes the Life Support cover presentation and button/Q/E airlock controls in earlier design/playtest records. Refs #72, #39. Engineering completion does not establish owner or device acceptance.

## Current behavior

- Twelve fixed cargo stacks (four slots at three depths) sit on the floor. Each has a smaller case resting on a larger case, perspective top/side faces, straps, seams, labels and contact shadows. Cargo and boarders share projected depth ordering. Covered enemies duck behind their own stack; only a helmet peeks above it. Exposed aiming regions and rule-owned projection/hit radii retain their existing dimensions.
- Each side door has a rule-owned target at (100,280) or (380,280), radius 23 logical pixels. A target lights during that side's relocating boarder approach/occupancy (the first two thirds of the existing 1.6-second relocation) when its independent airlock is ready. Departure, absence of a crossing, opening and recharge leave the target unlit. These dimensions are provisional playtest tuning.
- Shoot a glowing target with the rifle to activate its door. Touch aims plus separate Fire; mouse aims and primary click/hold fires; keyboard arrows/WASD aim at the existing normalized 225px/s cap and Space/Enter fires. Fire also works with mouse or keyboard aim. There are no Vent buttons or Q/E shortcuts. Controls use the same rifle cooldown as enemy shots. A shot hits one lit control or one exposed boarder, with control priority if their aiming areas overlap; an unlit control does not intercept a shot.
- Airlocks retain a 0.6-second warning and independent eight-second recharge (16 seconds on Natural 1). Occupancy is evaluated at warning expiry: a late shot may open an empty bay and still consumes the recharge. Ejection wins a tied enemy emission; already-fired lasers remain live.
- Doors slide open, airflow streaks move into the opening, and ejected boarders move toward the doorway while shrinking/fading for approximately 0.45 seconds. This duration is provisional. Ejection and its 125-point reward occur once at warning expiry; animation has no collision/damage/scoring role. Reduced motion suppresses decorative streak motion and spin. Simulation timers freeze on pause and clear on retry. Pooled graphics/images are reused and hidden outside this mode.

## Engineering evidence — 2026-11-06

Based on current main `09a416a` (PR #74), feature branch `codex/boarding-cargo-airlock-targets`. Current code and this record are delivered together in the linked review PR.

- `npm test`: **338 passed**. Coverage includes lit/unlit controls, approach/occupancy/departure boundaries, radius misses, rifle cooldown, independent recharge, all four bands with/without Natural 1, late/empty vent, one-shot resolution, ejection/attack ordering, single awards, persistent lasers, effect expiry, pause/interruption/retry, fixed cargo depth, covered-body visibility, pooled layers and frozen-state rendering/fallbacks.
- `npm run build`: passed; the existing deferred Phaser chunk-size advisory remains.
- `node --import tsx scripts/calibrate-scores.ts`: 288 seeded samples per mode. All twelve modes retain their prior observed percentiles; Life Support P10/P50/P90 = **61/3100/4900**. No anchors, rewards, bands or report version changed. Synthetic samples are not human balance evidence.
- `scripts/browser-boarding-check.cjs`: passed in isolated headless Chromium contexts at desktop 1440×1100 and **emulated touch** 390×844 and 320×844. Includes all four Boarding stations, keyboard aiming/firing, mouse and touch rifle actions, no firing from touch aim alone, both shootable door controls, independent recharges, frozen ejection effects, pause/resume/resize, reports/retry, Natural-1 retry, map challenge links/save/reload and missing-art fallback. Crossing fixtures freeze the simulation while the test runner scrolls/positions inputs, then resume to consume real input events; they do not prove human reaction time or full-round balance. No runtime/console errors in the main flows.
- `scripts/browser-polish-check.cjs`: passed for all eight earlier station combinations and map flows at desktop/390px/320px, with no runtime/console errors.
- Baseline screenshots: `/tmp/boarding-cargo-baseline/`. Updated screenshots and JSON checks: `/tmp/boarding-cargo-qa/`, including door opening/ejection at each tested width. These are local QA artifacts, not shipped assets. Canvas screenshots were visually inspected at narrow widths and in fallback mode.

## Owner playtest checklist

- [ ] At all four difficulty bands with/without Natural 1, assess readable cover/exposure and whether crossing targets provide enough reaction time.
- [ ] Shoot each door target, try a late shot, and confirm door opening, suction, single ejection rewards, separate recharges and persistent incoming lasers.
- [ ] Check actual iPhone Safari and iPad Safari in portrait/landscape: touch aiming plus Fire, readable door targets, pause/resume and retry. Emulation above does not establish these checks.
- [ ] Check desktop keyboard-only aiming/firing and mouse controls; assess full-round pacing and provisional ratings.
- [ ] After Drake reviews/merges, verify successful automatic deployment and its revision. Record explicit owner acceptance and device/control coverage before closing #72 or applicable #39 criteria.

No merge, deployment, or issue closure is performed by this change.
