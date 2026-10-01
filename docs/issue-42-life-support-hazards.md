# Space Battle Life Support — sparks and fire contact

> Historical record: Space Battle Bomber's missile controls and Life Support's Repair action have been replaced. Use [the station simplification checklist](space-battle-stations-playtest.md) for current acceptance; observations below retain their original meaning.

Issue [#42](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/42), related acceptance [#10](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/10) / [#39](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/39). Base: current main `947e056`, including PR #43 artwork. This is a reviewable gameplay proposal responding to Drake's Hard/check-2 playtest feeling too easy, not final balance acceptance.

## Delivered behavior

- Electrical faults emit two horizontal sparks at platform y−14, starting one second after appearing. Amber outlines and directional marks warn for the final 0.8 seconds. Hard/Easy/other bands use the approved provisional interval/speed table in README. No warning damage or homing.
- Grounded nearby Repair cancels future bursts before same-step emission; airborne sparks persist. Electrical panel contact remains safe. Sparks use radius-four circular collision, swept against the moving 20×27px crew body. They disappear on contact (including grace), leaving the board, or four-second expiry. New sparks begin moving on the next step.
- Ordinary fires arm after a visible 0.6-second spawn warning. Their contact box spans ±12px horizontally and 22px above the platform. Side/rising contact damages; the valid descending approach is protected until the existing stomp plane clears the fire once. This protection is necessary because the visible/hurt flame extends above that plane.
- Flame contact, sparks and overloads share one-integrity loss and 1.25-second grace, resolved in that order. Uncontained-fire expiry remains independent. Fatal damage ends immediately before later pickups can revive the crew.
- Reports include separate spark and fire-contact hit counts. All controls, platform geometry, five-integrity pool, 60-second duration, scoring formula/anchors, difficulty bands, and separate Natural 1 icon mix remain unchanged. No new dependency/assets/campaign lore.
- Simulation time drives warnings and movement; pause/completion freezes them. Reduced motion freezes only added decorative modulation; directional warning marks and dangerous moving projectiles remain visible.

## Validation evidence

- **95/95 tests pass**: twelve new mechanics regressions and one new renderer regression, plus expanded frozen renderer fixtures and pause tests. Covers first/repeated bursts in all bands, Natural 1 cadence parity, warning grace, repair-before-burst, retained projectiles, safe stomps, side/rising contact, circular swept collision, moving crew, expiry before a later collision, cleanup, shared grace/expiry independence, fatal damage, retry, and reduced-motion visibility.
- Production build and `git diff --check`: passed. The existing deferred-Phaser large-chunk advisory remains.
- Synthetic calibration: 288 Life Support runs now have p10 80 / median 246 / p90 926, vs 128 / 398 / 1,350 before. Live anchors stay 130–1,350; no other mode distribution changed. Synthetic scripts are not human players.
- Desktop Chromium actual game: launched Hard/check 2; keyboard movement input and Jump/Repair button attempts, explicit pause, automatic focus-loss pause, resume, failure results, Copy, and return/restart exercised. An unattended 390px run failed at 19.1 seconds, 95 raw points, with four expired fires and one spark hit. This confirms a live spark/integrity/report path; it is not skilled-player evidence or a claim that Hard is fairly tuned.
- Measured real-shell desktop frames at 320px and 390px have equal client/scroll widths (no horizontal overflow); controls and updated instructions remain outside the playfield. This is desktop input/layout evidence, not physical touch or Safari. Some narrow-frame Pause clicks failed despite a visible control, with MutationObserver errors in the temporary parent harness; complete narrow interaction acceptance remains pending. Actual-game and deterministic-fixture console warning/error logs were empty.
- Temporary deterministic browser fixtures rendered warning and active-spark states, a successful repair with a launched spark retained, safe stomp (one cleared fire, five integrity), fire contact (one damage), fatal contact, fresh retry, and a terminal 60-second fixture. Fixture completion does not establish an actual full-round human success. Screenshots live in the Codex task; no QA harness is shipped.

## Pending owner/device playtest

- [ ] Real iPhone/iPad Safari, portrait/landscape: readable warnings and spark cores, simultaneous movement/jump/repair, no accidental scrolling, reachable controls and acceptable performance.
- [ ] All four bands, with and without Natural 1; specifically repeat check total 2 and record raw points, rating, repairs/stomps and each damage count.
- [ ] Deliberately dodge sparks, repair a warning source, stomp a flame safely, and walk into a flame; confirm safe routes and useful feedback, including reduced motion.
- [ ] Full live completion/failure, pause/app switch/explicit resume, retry, and report Copy. No held action should leak across lifecycle changes.
- [ ] Drake accepts pressure/fairness and presentation in #39/#10; consider rating saturation separately using actual runs.

Keep #42 open for further mode reviews and rating calibration. Drake reviews and merges; no deployment is manually triggered.
