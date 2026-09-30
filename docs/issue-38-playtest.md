# Issue #38 — Space Battle / Gunner implementation and playtest

Status: **implemented on the feature branch; review, real-device checks, and owner acceptance pending**. Follow the [approved design](space-battle-gunner-design.md). This record supports #38 and [final owner acceptance #39](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/39); it does not establish a pass for any pending device or gameplay gate.

## Verification — 2026-09-29

- `npm test`: 79/79 passed. Coverage includes all eight modes and 18 additional Gunner/input/layout tests. New coverage verifies spawns and armor, once-only enemy shots, interception and target ties, same-step player-hit precedence, source-independent projectiles, breach cleanup/grace, 60-second/hull endings, terminal immutability, fractional scores, all check boundaries and Natural 1 cooldowns, pointer mapping and normalized keyboard aiming.
- Input coverage verifies aim-only touch, simultaneous independent aim/Fire pointers, retained aim, per-pointer release/cancellation, normal-release/capture-loss quick taps, keyboard/pointer handoff, combined firing sources, discarded attempts during cooldown, and clearing held/queued actions on pause/blur. Startup tests cover deferred launch/backgrounding, explicit resume, retry, mode changes, HUD, and complete/failure reports for the new mode. These are automated events, not physical multitouch evidence.
- `npm run build`: TypeScript and Vite production build passed. The existing deferred Phaser large-chunk advisory remains. `git diff --check` passed. No generated build or QA screenshots are committed.
- Seeded calibration: 288 runs for Gunner produced min 36, 10th percentile 37, median 2,038, 90th percentile 5,000, max 6,000. v0.5 uses fixed anchors 37–5,000; all seven older sample rows and live anchors remain unchanged. Synthetic direct aiming is not a human/keyboard balance test.
- Local Codex in-app Chromium QA used the Vite development server. Observed setup, Fire-button and keyboard firing, explicit pause/resume, retry, responsive layout, and complete hull-failure reports. A Very Easy/check 16 standard run reported 54 raw points, 10.7 seconds, two shots and three damaging hits. A Hard/check -5/Natural 1 unattended run reported 37 points, 7.4 seconds, zero shots and six breached threats. Both reports included v0.5 ratings and the GM boundary. Copy was exercised separately; no console warnings/errors were observed.
- Desktop/phone-size layouts were inspected at 320, 390, 616, 617, 632, 633 and 900px. Fire sits below the canvas through 632px and beside it above that width. No horizontal page overflow or control/playfield overlap was observed. QA found and fixed a narrow desktop container and a scrollbar-width cliff at the original 616px rail transition. Gunner now budgets another 16px; existing Bomber layout is unchanged. Phaser resizes asynchronously, so allow its canvas fit to settle after changing viewport size.

Rendered QA does **not** establish physical touch, real iPhone/iPad Safari, successful interception/armor kills, a rendered 60-second completion, all-band human balance, or final owner approval. Deterministic tests cover those mechanics and completion; Drake's real gameplay/device checks remain pending. Screenshots were inspected locally and kept outside the repository.

## Owner/device checklist — pending

Record tested commit/build URL, device model, OS/browser, orientation, date, check total, Natural 1, raw score/rating/end reason, and observations in #39. The draft branch has not been merged or manually deployed.

- [ ] On real iPhone and iPad Safari, aim without firing. Use another finger to tap/hold Fire, release each finger independently, cancel touches, and confirm retained aim and no accidental scrolling. Fire coordinates must never change aim.
- [ ] On desktop, aim/fire with keyboard and mouse. Check diagonal keyboard speed, input handoff, quick taps, held firing, and one shared cooldown. Asteroid Gunner retains its original pointer-only controls.
- [ ] Distinguish unarmored/armored attackers, armor pips, firing telegraphs, diamond projectiles/trails, reticle readiness, defense line, and damage protection. Destroy sources and intercept already-fired projectiles.
- [ ] Play all four check bands with and without Natural 1, including negative totals. Review several completed and failed runs and compare advisory ratings with Drake's judgment. All tuning is provisional.
- [ ] Pause, switch apps/tabs during launch and play, return and explicitly resume, rotate portrait/landscape, retry and switch modes. Confirm no stale firing, stuck controls, HUD clipping, or obstructed Fire.
- [ ] Read/select or optionally copy complete reports; explicitly record Drake's final gameplay, score/rating, and real-device approval. Keep pending entries open until evidence exists.

## Related acceptance audit

- **#2 — setup/checks/impairments:** automated coverage verifies integer/negative totals, band boundaries, no second check adjustment, and implemented role impairments. Boarding Party's four activities/impairments are still awaiting design approval under #11. Leave #2 open; this change cannot establish requirements for those modes.
- **#3 — shared controls:** prior six-mode evidence and current regressions remain available. Space Battle Gunner now supports keyboard plus direct pointer aim, while Asteroid Gunner retains its approved exception. Real Safari simultaneous controls, rotation, focus loss and final acceptance still need evidence for the newer modes. Leave #3 open.
- **#10 — Life Support:** [its playtest record](issue-10-playtest.md) still has pending iPhone/iPad Safari and owner checks. Its existing automated tests passed in this branch; no new physical-device evidence was available. Leave #10 open and complete those device checks alongside Gunner.
- **#11/#39:** Boarding Party framing/design comes next; it stays disabled. All 12 final-acceptance rows require actual evidence and Drake's approval. No earlier signoff is silently carried forward.
