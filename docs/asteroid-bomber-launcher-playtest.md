# Asteroid Bomber: aimed aft launcher

Implemented from main `fe91319` using Drake's approved short-range launcher plan. Refs #39; engineering checks do not close owner acceptance.

## Behavior

Asteroid Bomber shares Space Battle's launcher controls and target geometry: aim within the rear 180° from the rack 34px behind the ship, choose 0–100px range, default straight aft at 100px. Pointer tap/drag-release launches; mouse hover previews and primary release launches. Left/Right or A/D rotates at 120°/second, Down/S selects straight aft and retains range. Space/Enter or Launch mine makes one attempt per press. Holding never repeats; cooldown attempts, forward releases and cancellations are discarded.

Mines travel at 500px/s, detonate at swept contact positions during travel and otherwise arm upon landing. Rack placements arm immediately. The preview path, landing cross and blast circle show the selected destination; landed mines stay fixed as the ship weaves. Lifetime starts on the release frame. Asteroid cooldown remains 0.65s, lifetime 5s and blast radius 66px, scaled by `sqrt(0.5)` on Natural 1. Hazard spawning, drift, ship course, hull, grace duration, round length and scoring anchors retain asteroid-specific values. Mine defense resolves before swept hull collisions. Pause freezes simulation and preserves aim/range while clearing gestures and pending actions; retry resets the launcher.

## Engineering validation — 2026-10-16

- `npm test`: 230/230 passed, including both Bomber control factories, placement at 0/25/50/100px, rear limits and range clamping, fixed landing destinations, cooldown rejection, lifetime, in-flight/release-frame contacts, lateral motion, swept hull collisions, exact splash boundaries, exactly-once scoring and Natural-1 geometry. Existing Space Battle regressions remain green.
- `npm run build` passed. The existing Phaser runtime chunk-size advisory remains.
- `git diff --check` passed.
- Browser plugin unavailable; used bundled Playwright with installed Chrome against `http://127.0.0.1:5173/galaxy-grown-games/`. Desktop viewport 1100×950; emulated-touch viewports 390×950 and 320×950. No dependencies or QA artifacts added to the repository.
- At each width, actual pointer release selected approximately 25px range. Controlled simulation stepping verified one launched mine and retained destination. Actual Launch mine presses at zero range destroyed an overlapping asteroid on the release frame with hull 3/3. Actual keyboard input rotated the reticle. Pause kept state frozen; explicit resume cleared pending actions. Controlled 60-second completion produced the manual report, and Back to setup/start reset direction, range and mine count.
- Page identity, meaningful content, absence of Vite error overlay and horizontal overflow, and desktop/phone screenshots were checked. The launch button remained outside the canvas. No application exceptions were observed. Desktop Chrome requested the existing missing local `/favicon.ico` (404); narrow-view checks had no console warnings/errors.
- These were controlled browser interaction checks, not complete natural rounds or real iPhone/iPad Safari. No production deployment was performed.

## Remaining owner playtest

- Play all four check bands with and without Natural 1; judge hazard pressure, launcher feel, splash readability, raw scores and ratings. Anchors stay 71–3,060 pending fresh calibration; synthetic outcomes changed as documented in scoring calibration.
- On actual iPhone and iPad Safari, check tap/drag-release, short/max/rack placements, cancellation, portrait/landscape, controls near the 616px rail transition and accidental scrolling.
- On desktop, check hover/primary release, keyboard aim and launch, cooldown rejection, pause/tab switching, explicit resume, hull failure, reports and retry. Confirm Space Battle Bomber still feels unchanged.
- Drake reviews/merges, automatic deployment must succeed, then owner acceptance is recorded against the tested deployed revision. Keep #39 open pending its remaining criteria.
