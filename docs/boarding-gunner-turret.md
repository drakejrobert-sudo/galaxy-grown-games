# Boarding Party / Gunner — first-person turret

[Issue #76](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/76) follows the original Gunner station (#70). Owner validation is tracked in #39.

The ship flies automatically. Aim through the fixed turret window and shoot one-hit probes or two-hit shuttles before they reach the dashed breach line. The **LAUNCH** ring means a craft can already be hit. Aim at the carrier between threats. Its remaining health, weapon readiness, and breach count are below the window. Disabling the carrier stops launches; craft already in flight and the round continue.

Touch the window to aim and use **Fire** separately. The mouse aims and fires with primary click or hold. Arrows/WASD aim and Space/Enter fire. All inputs share the cooldown, which doubles on a Natural 1. The turret reorients the same hit areas, timing, and scoring. The GM still receives a manual score report.

## Engineering playtest

- Run the full suite and production build. The scene tests cover screen coordinates at the inclusive hit boundary, diagonal keyboard speed across substeps, and warning and hit feedback with reduced motion and missing art. The seeded Gunner score anchors remain 46–3,220.
- Chromium desktop and 320px/390px emulated touch: compare live launch-warning captures against main. Check mouse and keyboard aim/fire, simultaneous touch aim and Fire, no shot from touch aim alone, pause/resume, copy/retry from a staged timed finish, and launch smoke checks for Pilot, Bomber, and Life Support.

## Owner playtest after deployment

- [ ] On desktop, iPhone Safari, and iPad Safari, track a launch warning, intercept a probe, and land two hits on a shuttle. Verify targets near the edges remain readable and line up with aim, and the breach warning is visible.
- [ ] Check each difficulty band with and without Natural 1. Disable the carrier, intercept remaining craft, and verify the round and manual report. Confirm pause, resume, and retry.
- [ ] Record the tested deployment revision, device and control coverage, and acceptance before closing the issues.
