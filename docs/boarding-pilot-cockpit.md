# Boarding Party / Pilot — first-person escape course

[Issue #77](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/77) follows the initial Pilot prototype (#69). Owner validation is tracked in #39.

## Flight

The ship moves forward automatically. Strafe with arrows or WASD. On a touch screen, hold and drag away from your starting point, then release to stop strafing. The fixed center reticle marks the ship's path. Natural 1 reduces strafe speed to 60% while preserving forward speed.

- Follow 15 teal guide beacons over 60 seconds. Each clear earns 100 points. Each miss forfeits those points and gives a missile or boarding probe a shot at your position. Strafe when the directional warning appears. The attack commits to its original path. The last main gate is at 58 seconds.
- Branch through three amber salvage beacons for 50 points each. The beacons sit near a torn hull rib, a broken panel, and a tumbling antenna. Follow the small amber lights back toward the main route. Two plus-marked repair rings restore one hull up to the starting maximum of three.
- Asteroids and wreckage also cross the main course. A steady amber outline means holding your current line will hit the object. Strafe clear, then line up the next teal ring. From Very Easy to Hard, the field adds 4, 5, 6, or 7 obstacles on the direct line between gates, plus up to seven scattered hazards. Counts are provisional.
- Missiles, probes, asteroids, and wreckage each cost one hull on contact and grant 1.25 seconds of collision grace. Zero hull ends the run early. Attack warning and flight times are provisional at 0.35 and 0.65 seconds.
- The four bands keep their existing strafe speeds and use provisional required-ring opening radii of 46, 56, 66, and 76 logical units from Hard to Very Easy. The first ring is centered. Ring locations and the debris around optional rings stay fixed. The rest of the field rerolls on retry.
- Pause freezes the course and clears active input. The manual GM report includes ring counts, misses, raw points, hull and the end reason. The GM decides the campaign outcome.

## Engineering and owner playtest

The course tests exercise seeded layout variation, direct-line impacts, dodge and impact timing, terminal ordering, and hit-free routes through the main course and all optional detours in every band with and without Natural 1 at 60 Hz, 30 Hz and 50 ms steps. The seeded scoring profiles are synthetic and use provisional anchors described in [scoring calibration](scoring-calibration.md).

After review and deployment, play the required route, then try the optional routes. Dodge an amber-outlined obstacle, recover the next teal gate, and compare layouts on retry. Check the ring cues, debris clearance, steering feel and readability on desktop, actual iPhone Safari, and actual iPad Safari. Check all four bands with and without Natural 1, missile and probe dodges, debris impacts and hull failure, pause and resume, retry, and copying the GM report. Record the tested revision and approval in #77 before closure.
