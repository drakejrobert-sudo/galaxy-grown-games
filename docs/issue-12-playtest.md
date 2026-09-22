# Issue #12 — results and cross-device playtest

Status: **complete**. Desktop browser QA and Drake's cross-device playtest passed for all six playable prototypes. Scores remain provisional and the GM determines campaign outcomes. Copying the detailed report is an optional convenience, not a release requirement; players may report only the final score.

## Desktop browser evidence — 2026-09-15

Tested the local Vite preview in the Codex in-app Chromium browser. Pilot and Gunner were viewed at the browser's desktop viewport (1280 × 720); the other modes were also exercised in that desktop browser with a 390 × 844 viewport override. Life Support and a negative-total Gunner run were additionally checked at 320 × 700. These narrow viewport checks are **desktop emulation**, not iPhone/iPad Safari or real touch input. Representative playfield, pause, setup, and report screenshots were visually inspected but are temporary QA artifacts and are not committed. No browser error or warning logs were observed.

| Playable mode | Observed browser flow | Result/report |
| --- | --- | --- |
| Asteroid Field / Pilot | Hard + Natural 1 launched; impairment and HUD appeared. | Hull loss ended the run; report showed check, difficulty, impairment, score, and GM boundary. Copy succeeded. |
| Asteroid Field / Gunner | Mouse aiming/click recorded a shot; Pause overlay and explicit Resume worked. A separate `-3` + Natural 1 run displayed Hard and overheated-gun impairment. | Both runs ended and produced role-specific reports. |
| Asteroid Field / Bomber | At 390px, Drop mine stayed reachable below the playfield; Pause and Resume worked. | Hard + Natural 1 report included mine count and half-area target. |
| Asteroid Field / Life Support | At 390px and 320px, all three route controls stayed visible; selecting Thrusters changed the pressed state. | Hard + Natural 1 report included routes, mistakes, integrity, hearts, and overloads. Copy succeeded. |
| Space Battle / Pilot | Hard + Natural 1 launched with readable fuel, hull, timer, and score at 390px. | Hull loss ended the run; report included fuel and hit statistics. A pointer drag was attempted, but movement was not visually confirmed before the run ended. |
| Space Battle / Bomber | At 390px, the forward reticle, aft mine preview, Fire missile, and Drop mine were visible. Clicking both buttons recorded one missile and one mine. | Hard + Natural 1 report included both weapon counts, hull, and score. |

Setup rejected `2.5` with a focused whole-number error. The difficulty readout was checked at `-3`, `5`, `6`, `10`, `11`, `15`, and `16`; negative totals were accepted, and the established boundary bands appeared. Natural 1 remained separate from the modified total. Automated tests cover additional input and scoring behavior that this browser pass did not visually prove.

### Defect found and fixed

At 390px, wrapped Bomber, Life Support, and Space Battle Pilot reports scrolled inside the old fixed-height text box, hiding final lines in a screenshot. The report now grows to its full rendered text and recalculates after viewport resize; it remains selectable and copyable. A 320px Life Support report showed its GM-boundary line without internal clipping, and widening the viewport to 390px reflowed the complete report. At 320px, the page itself still scrolls because the full report exceeds one phone-height viewport.

### Browser limits

The in-app browser did not provide a trustworthy real app-switch/visibility-loss observation; deterministic startup tests cover blur, hidden-at-ready, and explicit resume. Mouse-driven narrow viewport checks did not prove real multitouch, Safari focus, rotation, or safe areas, so those remained part of Drake's device pass. Clipboard failure was not a device gate because copying the full report is optional. Cold-load timing on a mobile connection and provisional balance were not measured.

## Drake's completed cross-device playtest — 2026-09-22

Drake completed the planned playtest across the playable modes and reported that everything looked good. This owner verification completes issue #12's device gate. The detailed report remains readable and screenshot-friendly, while sharing or pasting every statistic is no longer required.

- **All six modes:** enter a GM-requested total, start, rotate during setup and play, finish a run, inspect the result, return to setup, retry, and switch modes. Check difficulty-boundary totals and Natural 1 for each role at least once. Confirm no score sends itself to a server or changes campaign state.
- **Asteroid Pilot and Space Battle Pilot:** steer by holding/dragging without teleporting or exceeding the keyboard speed cap; inspect hazard and fuel readability, collision feedback, and pause/resume.
- **Asteroid Gunner:** tap, hold, and drag to aim/fire; check reticle, armor/health pips, cooldown feedback, defense-line impacts, and the approved pointer-only controls.
- **Asteroid Bomber:** time aft mine releases with the button while the ship flies automatically. Check the preview and Natural-1 circle, safe asteroid escapes, and whether the button stays reachable.
- **Asteroid Life Support:** route with all three buttons, read colors and symbols at phone size, observe heart repair and overload damage, and keep controls clear of the playfield.
- **Space Battle Bomber:** aim ahead while using Fire missile and Drop mine independently, including simultaneous fingers. Confirm missile aim cannot steer the ship or move the aft mine drop point; inspect both targets and buttons at narrow widths.
- **Lifecycle:** switch to another app during the first download and during play, return, and confirm the timer and input remain stopped until explicit Resume. Check pause overlay, backgrounding, rotation, and retry after a completed or failed run.

No defects were reported from this pass. Cross-mode score normalization and mapping scores to consistent outcome bands are intentionally deferred to a dedicated design issue; no campaign outcomes are inferred automatically here.
