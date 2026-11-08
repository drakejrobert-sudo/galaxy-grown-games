# Boarding Party / Gunner — first-person cockpit

[Issue #76](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/76) follows the original Gunner station (#70) and [the first turret view](https://github.com/drakejrobert-sudo/galaxy-grown-games/pull/82). Owner acceptance is tracked in #39.

The ship flies automatically. Aim through the glass from behind the turret. Probes and shuttles approach nose-first and grow as they close. **LAUNCH** marks a craft you can already shoot; **BREACH** means it has half a second or less before contact. A red canopy flash confirms hull damage. Probes take one hit and armored shuttles take two. Aim at the carrier between threats. Disabling it stops launches, and active craft and the round continue.

Touch the window to aim and use **Fire** separately. Mouse movement aims and primary click or hold fires. Arrows/WASD aim and Space/Enter fire. All inputs share the cooldown, which doubles on a Natural 1. The GM still receives a manual score report.

The camera projects the existing approach paths into screen space. The reticle, hit test, and target rings agree in that space, including the fixed seven-pixel aim allowance. The carrier cycle, world-space breach line and impact timing are unchanged. The camera stays fixed while aiming and remains useful with reduced motion or missing artwork.

## Engineering playtest

- Compared against merged PR #82 (main revision `89b5da8`). All 349 automated tests and the production build passed. Focused checks cover projected hit boundaries, nearest-target ties, warning and damage timing, feedback alignment, diagonal aim, reduced motion, and missing-art fallbacks. The build still reports the existing Vite bundle-size advisory.
- All 288 seeded Gunner samples use projected aim. The min / P10 / median / P90 / max remains **35 / 46 / 299 / 3,220 / 4,220**, matching the baseline. The rating anchors remain **46–3,220**. Synthetic samples do not establish human balance.
- Desktop Chromium (1440 px) and emulated touch (320 and 390 px): captured the live launch warning before and after and the new close approach. Checked canopy clearance, asset decoding, live growth and breach, mouse and keyboard controls, simultaneous touch aim and Fire, aim alone without firing, pause/resume, manual report copy and retry after a staged timed finish, and launch smoke checks for Pilot, Bomber, and Life Support. The real device and owner checks below remain pending.

## Owner playtest after deployment

- [ ] On desktop, iPhone Safari, and iPad Safari, track a launch, intercept a probe, and land two hits on a shuttle. Check aim alignment, canopy clearance near the sides, and whether the BREACH cue arrives in time to react.
- [ ] Play each difficulty with and without Natural 1. Disable the carrier, intercept remaining craft, and confirm the round and report. Check pause, resume, rotation, and retry.
- [ ] Record the deployed revision, device and control coverage, and explicit acceptance before closing the applicable issues.
