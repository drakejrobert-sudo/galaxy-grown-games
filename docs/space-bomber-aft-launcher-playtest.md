# Space Battle Bomber aft launcher — engineering playtest

Implements the approved aft-launcher follow-up to the mine-only redesign and raised station. Refs #39; this record does not establish owner acceptance or close the issue. Based on main `64d41e1` (merged height adjustment #48).

## Mechanics and controls

Ship height stays at y=140 and the eight-second weave stays automatic. Pointer releases behind the aft rack choose a direction in the rear half-circle. Touch tap or drag/release and mouse primary release launch; mouse hover previews. Forward releases and cancellations discard the attempt. Left/Right or A/D rotates at 120 degrees/second, Down/S selects straight aft, and Space/Enter or Launch mine attempts one launch per press. Cooldown attempts are discarded.

Mines travel exactly 100px in 0.2 seconds, arm on landing, and remain there. The 4.5-second lifetime starts at launch; cooldown stays 0.85 seconds. Preview and explosion boundaries use the damage radius, including Natural 1's half area. A clean crossing retires the pursuer into a fading cyan 0.3-second peel-away; retired ships cannot hurt the player or interact with mines. Swept armed contacts resolve before swept ship collisions, clipped at the crossing instant.

Pause freezes mines, hazards, flight, cooldown and animations. Aim survives pause while input gestures and queued actions clear. Retry defaults to straight aft with no progress retained. Other modes keep their existing controls and stationary mines.

## Automated validation

- `npm test`: 152 tests passed, including rear aim limits/speed, launch distance and retained landing position, travel immunity, exact landing/arming, expiry windows, cooldown rejection, pointer cancellation, quick keyboard taps, pause and reset.
- Four bands with/without Natural 1: committed intercepts, fuse/blast geometry, swept contacts, crossing-step and frontal collisions, simultaneous protection, defense priority, clean retirement and no later collisions/mine triggering.
- Frozen render fixtures include mines in flight, angled preview and harmless passes. Shared startup, results, ratings, Life Support and other-mode regressions pass.
- `npm run build` and `git diff --check` pass. Vite retains the existing deferred Phaser chunk-size advisory.
- 288 seeded Bomber score samples refreshed separately from live anchors; see [scoring calibration](scoring-calibration.md).

## Browser evidence and limits

Desktop Chrome and narrow-screen Chrome with emulated touch exercise actual mouse/CDP touch gestures against the local Vite app. A temporary QA-only module hook exposes state for assertions and terminal fixtures; no hook or QA artifacts ship. Terminal completion/failure fixtures validate reports and retry, not a naturally played 60-second round. At 1100×1000, 390×844 and 320×780, mouse/keyboard and actual emulated-touch tap/drag/release, cooldown discard, forward release cancellation, touch cancellation, aim retention through pause, and single held-key launches passed. Screenshots at each width were inspected: ship/landing path, blast circles, bottom markers and reserved Launch mine control remained visible with no horizontal overflow. Failure/completion report fixtures and Back to setup/start reset passed. Desktop logged no browser errors. Emulated touch cancellation emitted Chrome's “Ignored attempt to cancel a touchcancel event with cancelable=false” diagnostic; cancellation still discarded the launch, with no application exceptions or other errors. That diagnostic does not establish Safari behavior.

Physical iPhone/iPad Safari and owner gameplay judgment remain pending.

## Owner checklist

- On real iPhone and iPad Safari, portrait/landscape: tap and drag/release aft, cancel a gesture, release forward, and verify no accidental scrolling. Check readable launch path, exact blast preview, landing marker and bottom approach markers; keep Pause and Launch mine reachable.
- On desktop: hover/release, held mouse without firing, keyboard rear limits, quick Down/S, single Space/Enter presses, and cooldown rejection. Check aim retention and no stale launch after pause/app switching; retry defaults straight aft.
- Play every band with/without Natural 1. Confirm intercept timing feels clean and fair, collisions before crossing still cost hull, and cyan peel-away ships cannot hurt or trigger mines later.
- Complete and fail real runs, read/share reports, and record raw score, rating and gameplay judgment on the tested deployed revision. Review gameplay acceptance separately from fresh human rating calibration; #39 remains open.
