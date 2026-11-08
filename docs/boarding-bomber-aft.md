# Boarding Party / Bomber — first-person aft station

[Issue #78](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/78) follows the original Bomber station (#71). Owner validation is tracked in #39.

Look out the rear window as the ship flies automatically. Probes and shuttles grow as they approach the dashed breach line; a bright ring marks a newly launched craft that can already be hit. After arming, mines rise toward the carrier in the aft window with a slight sideways sway. They can intercept craft or damage the carrier during launch or drift. Disabling the carrier stops new launches, while active craft and the round continue.

Tap or drag and release above the rack to place a mine. Mouse hover previews; primary release launches. A release outside the window or below the rack is discarded. Left/Right or A/D rotates aim; Down/S selects straight aft. Space/Enter or **Launch mine** fires once at the previewed direction and distance. The rack's light is the zero-range launch point. The landing cross and projected blast outline show where a mine will arm and what area it can affect there.

Drift is provisionally tuned to 70 logical pixels per second with a 12-pixel sideways sway over a 1.6-second cycle. The live coverage ring follows the mine as it drifts. The asteroid debris experiment remains a separate item under #78.

## Owner playtest after deployment

- [ ] On desktop and actual iPhone/iPad Safari, track a launch warning and intercept both craft types. Check that the carrier, armor, breach line and mine cues remain readable in portrait and landscape.
- [ ] Aim at the rack, near targets and distant targets; verify that each mine starts drifting at the previewed arming point. Confirm it can reach the carrier beyond that point. Try releasing below the rack, pausing during a gesture, and retrying.
- [ ] Check each difficulty band with and without Natural 1, including mine hits on the carrier, round completion, and the manual score report. Record the deployed revision, device and control coverage, and explicit acceptance.
