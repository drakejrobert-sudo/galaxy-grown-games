# Space Battle Bomber: shorter launches and in-flight contacts

Approved follow-up to merged PR #49, based on main `0730f66`. Refs #39; engineering validation does not close owner acceptance.

## Behavior

Pointer targets in the rear half-circle select a landing point 0–100 logical pixels from the aft rack. Farther targets clamp to 100px; forward releases/cancellations are discarded. Mines travel at 500px/s, so 25px takes 0.05s, 50px 0.1s, and 100px 0.2s. Selecting the rack places an immediately armed stationary mine.

Moving mines use the existing contact fuse (enemy radius + 8px), detonate at the swept contact position and destroy the struck ship. Splash checks other active ship centers against the existing exact blast circle at that instant. Travel and stationary spans split at landing, are clipped at expiry and enemy retirement, and resolve before hull damage. Multiple contacts cannot double-score or cause phantom detonations. Travelling mines display the amber live core because they can now damage ships.

A mine’s fixed destination and travel duration never change after launch. Preview direction/range remain selected once hover or a gesture ends, rather than drifting as the ship weaves. Keyboard rotation and Down/S retain range; Space/Enter and Launch mine use that preview. Pause preserves direction/range and clears gestures/queued actions; retry defaults straight aft and 100px.

Ship flight, clean-pass retirement, cooldown (0.85s), lifetime (4.5s from launch), Natural-1 half-area blast, enemy pressure, scoring/rating anchors and other modes are unchanged. Distance/speed remain provisional playtest values.

## Automated validation

- `npm test`: 186/186 pass, including 0/25/50/100px and clamped targets, fixed speed and destinations, retained shortcut range, landing and lifetime boundaries, pause/reset, cancellation and cooldown.
- All four difficulty bands with/without Natural 1 cover moving relative sweeps, contacts missed by endpoint checks, actual contact-centered splash, exact blast boundary inclusion, multiple mines/targets, expiry during flight, defense priority and retired-ship exclusion.
- Updated render tests cover selected landing markers, exact blast geometry, contact-live travel artwork and frozen states. Shared startup, controls, reports, other-mode mechanics and rating regressions pass.
- `npm run build` and `git diff --check` pass. The existing deferred Phaser chunk-size advisory remains.
- Synthetic profiles/reference samples refreshed independently of the live anchors; [scoring calibration](scoring-calibration.md).

## Browser evidence and limits

Local Chrome QA at 1100×1000 (mouse), 390×844 and 320×780 (emulated touch) exercised actual short tap/click, drag preview/release, keyboard/button reuse of the selected ~45px range, rejected cooldown presses, mouse forward release, touch cancellation, explicit pause/resume and reset. Selected distance remained stable while the ship weaved. Screenshots of desktop and narrow-screen previews and the impact state were inspected; controls, HUD and blast/landing markers remained visible with no horizontal overflow.

A temporary QA-only module hook exposed simulation state for assertions. A controlled active-pursuer fixture and an actual Launch mine button press confirmed destruction before landing with an explosion at the contact point. Hull remained unchanged during that fixture. Completion/hull-failure fixtures exercised reports and Back to setup/start reset; they are not naturally played full rounds. No hooks or QA screenshots/scripts ship.

No application exceptions or other errors were observed. As in PR #49, emulated touch cancellation emitted Chrome’s “Ignored attempt to cancel a touchcancel event with cancelable=false” diagnostic; the launch was still discarded. This does not establish Safari behavior.

## Remaining owner checklist

- Real iPhone/iPad Safari, portrait/landscape: near/far taps, drag/release, forward release/cancellation, readable preview/approach markers and reachable Launch mine/Pause without accidental scrolling.
- Desktop: mouse range selection and rear limits; keyboard/button retained range, single launches and cooldown rejection; pause/tab switching without stale actions and retry at default range.
- All bands with/without Natural 1: direct in-flight hits and stationary interceptions should feel clean, while retired ships stay harmless. Confirm close placement does not make pressure trivial.
- Complete/fail real rounds, read/share reports and record tested revision, raw points, rating and gameplay judgment. Physical Safari, owner gameplay acceptance and fresh human rating calibration remain pending; keep #39 open.
