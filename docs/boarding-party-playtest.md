# Boarding Party engineering validation

Implementation base: current main `d38b7ae4c6e1e0d8b6fd4c08801ade285a092086`, branch `codex/boarding-party-stations`. Approved design: [Boarding Party handoff](boarding-party-design.md). Validation performed on 2026-11-06; implementation PR supplies the tested commit. No deployment or owner acceptance is claimed.

## Engineering checks

- `npm test`: 315 tests pass, including 27 Boarding Party simulation tests, four vent/aim input tests, raw-frame substep/lifecycle, frozen-state rendering, setup/retry/resize, map links, scheduled pause and save round trip. Existing v1 migration, import failure and library isolation coverage remains in the full suite.
- `npm run build`: passes, with the existing Phaser large-chunk advisory.
- `node --import tsx scripts/calibrate-scores.ts`: 288 deterministic samples per mode; existing eight mode samples and fixed anchors retained. New modes use the 10th/90th percentiles below.
- Existing `scripts/browser-polish-check.cjs`: passes map flows and all eight existing stations at 1440px desktop and emulated-touch 390/320px widths.
- New `scripts/browser-boarding-check.cjs`: passes all four Boarding Party stations at those widths: situation-link prefill, keyboard movement/aim, mouse/touch firing, touch aim without firing, mine launch, Q/E and independent vent cooldowns, pause freeze, 615/633px resize boundaries, results and retry, scheduled Boarding Party map reveal/reload/resolution, console/runtime health and page-width containment.

Browser checks use desktop Chromium through an existing Playwright installation because a Browser plugin was unavailable. Chromium and local Vite required sandbox escalation. Tests use isolated browser contexts and synthetic fixtures. Live inputs are exercised; screenshots use deliberately staged readable threats, and completion/result boundaries use synthetic end states. These are not earned full-round scores. Temporary evidence lives outside the repository under `/private/tmp/boarding-existing-modes` and `/private/tmp/boarding-new-modes`; no private campaign saves are used.

## Synthetic calibration v0.6

Three profiles ×12 seeds ×4 difficulty bands ×2 Natural 1 states, at 50ms steps using the existing xorshift seeds and percentile convention. Passive does nothing. Routine Pilot sweeps sinusoidally; engaged Pilot evaluates eight movement headings/staying still against a one-second forecast of fixed pod paths and carrier proximity. Routine weapons attack intermittently; engaged Gunner prioritizes urgent pods then carrier, engaged Bomber selects rear threats within launcher range. Routine interior defense shoots intermittently; engaged targets the next exposed attacker and vents occupied zones. Profiles approximate direct pointer aiming, not human or keyboard performance.

| Mode | Samples | Min | P10 / low anchor | Median | P90 / high anchor | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Boarding Pilot | 288 | 61 | 62 | 297 | 900 | 900 |
| Boarding Gunner | 288 | 27 | 31 | 221 | 3418 | 4320 |
| Boarding Bomber | 288 | 27 | 31 | 241 | 4100 | 4200 |
| Boarding Life Support | 288 | 45 | 53 | 3100 | 4900 | 5000 |

These references establish repeatability and non-collapsed anchors, not fairness. Carrier HP differs by station to support sustained turret damage versus occasional close-range mines. Real runs may require new boarding-specific tuning and anchors.

## Remaining owner checks

- [ ] Review/merge the PR and verify the automatic deployment revision before calling it live.
- [ ] On actual iPhone/iPad Safari: play all four stations, rotate, background/resume, and verify aim plus Fire and vent use with multiple fingers.
- [ ] On desktop: keyboard/mouse aim, one-press mine/vent actions, targeting visibility, pause, report copy and retry.
- [ ] Play each difficulty with/without Natural 1; assess carrier warning readability, Pilot evasion, carrier-versus-pod priorities, mine reach and breach pressure.
- [ ] Assess interior cover/exposure, rifle feedback, airlock timing, independent recharges and double-recharge impairment.
- [ ] Compare multiple completed and failed runs against the provisional advisory ratings.
- [ ] Add a Boarding Party card to an existing campaign, weight its route table, test scheduled/random reveal and share with the crew; receive reports and resolve explicitly.
- [ ] Record accepted revision and actual device/control coverage before closing implementation issues or the related #39 rows.

No live multiplayer, automatic damage/rewards, campaign canon changes, friendly-fire system or Maps VTT integration is introduced.
