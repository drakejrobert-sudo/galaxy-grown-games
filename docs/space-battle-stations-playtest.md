# Space Battle station simplification

Bomber now times individual mine drops against committed pursuing ships; it has no missile aiming or forward attackers. Life Support repairs electrical panels automatically while grounded nearby for 1.5 accumulated seconds. Leaving/jumping preserves progress, while panel deadlines and spark hazards continue. Existing check bands, Natural-1 impairments, rounds, scoring formulas, and rating anchors remain provisional and unchanged.

## Automated validation

- `npm test`: 125 tests passed. New coverage exercises committed prediction/straight paths and warning lifetime across four bands with/without Natural 1, mine press/repeat/cancel behavior, rejected cooldown attempts, aft placement, stationary mines, fuse/lifetime/blast boundaries, collision grace, safe escapes, round completion and failure.
- Repair coverage includes 1.5-second accumulation, retained interruption progress, airborne/wrong-platform/out-of-range rejection, inclusive range, nearest/ID target selection, expiration versus completion, exactly-once scoring/feedback, zero-time pause and fresh retry. Existing electrical sparks, fire contact/stomps, heart/overload mix and scoring tests remain.
- `npm run build`: TypeScript and production Vite build passed, with the existing large Phaser chunk advisory.
- Updated seeded calibration reproduces other modes' reference results. Both changed modes produce lower synthetic outcomes; see [scoring calibration](scoring-calibration.md). These scripts are coarse approximations of human play. Existing anchors require fresh human review and were not adjusted here.

## Desktop Chrome evidence

Playwright ran the actual Vite shell in desktop Google Chrome, with a temporary response-only scene hook for inspection/fixtures; no QA hooks or artifacts are shipped.

- Actual keyboard input: holding Space for over a second produced one Bomber mine, followed by a second mine after a new key press. The mine button also released a mine at narrow widths.
- Actual simulation against a deterministic panel fixture: the repair bar accumulated about 0.7 seconds, pause froze state, and explicit resume completed exactly one automatic repair. Keyboard movement/jump worked. Controls are Left, Right, Jump; no Repair control exists.
- Both modes froze under explicit pause/resume. Completion/failure reporting, copying and retry use deterministic state fixtures, not player-earned runs.
- Unobstructed screenshots and canvas bounds were checked at 1100px, 320px and 390px. No horizontal overflow; canvas retained available width, mine action and three platform controls stayed outside it, pursuit markers and repair bars were readable. Frozen screenshots include approach markers, partial/empty repair bars and completion feedback.
- The interaction pass reported no browser page or console errors. A resize measurement taken immediately after mode switching initially returned a zero-size canvas; after allowing Phaser to resize, every measured canvas had positive full-width dimensions. No persistent blank canvas was observed.

Desktop Chrome with narrow viewports is not physical touch or iPhone/iPad Safari evidence. Human mine interception timing, skilled fire stomping, all-band balance and earned 60-second runs remain owner acceptance items.

## Owner playtest checklist

- [ ] iPhone/iPad Safari and desktop: Bomber ship weaves without steering; ships approach only from behind on readable fixed paths, with brief bottom-edge markers.
- [ ] Time individual mine taps/Space/Enter presses; holding does not repeat and cooldown taps do not release later. Check arming, expiry, blast preview/readiness and Natural-1 half-area blasts.
- [ ] Intercept pursuers with mines; verify collision-only hull loss/grace and harmless escapes across all bands with/without Natural 1. Judge whether predictive approaches and cadence feel fair.
- [ ] Life Support: simultaneous movement/jump, fire stomps, hearts, sparks and overloads; stand near panels and read progress. Leave/jump and return to continue. Verify expiry pressure while repairing.
- [ ] Portrait/landscape on iPhone/iPad, reachable external controls, readable markers/bars, explicit pause, focus-loss pause, resume and fresh retry.
- [ ] Earn completed and failed runs in both modes, inspect/copy reports, and compare rating to your gameplay judgment before recalibrating anchors.

## Bomber height follow-up

Owner feedback after merging #47 requested more room to drop mines. The Space Battle ship now flies at 25% of playfield height (y = 140), up from 56% (y = 313.6); mines release at y = 174. This adds 173.6px of approach space, approximately 0.86–1.88 seconds across the current speed range. Intercept predictions automatically account for the new height. Other modes and all weapon/enemy cadence rules remain unchanged.

Engineering validation: all 125 tests and the production build passed (existing Phaser chunk advisory). The all-band/Natural-1 pursuit regression now requires over two seconds from spawn to the mine row at base speed, a mine row in the upper third, and correct committed intercept prediction. Updated synthetic Bomber references are documented in scoring calibration; live rating anchors remain unchanged.

Desktop Chrome actual-shell checks at 1100/390/320px verified y = 140, keyboard release at y = 174, positive full-width canvas bounds, no horizontal overflow, readable ship/mine/pursuer artwork, external action placement, and pause/resume. Screenshots were inspected; no browser page/console errors were reported. Physical iPhone/iPad Safari and owner judgment of the increased mine-timing window remain pending under #39.

- [ ] After review/merge and successful automatic deployment, test mine timing on desktop and iPhone/iPad Safari across difficulties, including Natural 1. Confirm the higher ship gives enough useful approach time and the mine preview stays readable throughout the weave.
