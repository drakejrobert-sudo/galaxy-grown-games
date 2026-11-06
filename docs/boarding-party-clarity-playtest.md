# Boarding Party clarity follow-up — engineering evidence

Date: 2026-11-06. Base: main `f80cfc9f40892e72997faad5de7b6780824f6412` (merged #73). Branch: `codex/boarding-party-clarity`. The implementation PR records its tested head. Refs #69, #70, #71, #72, #39. [Current design](boarding-party-clarity.md); [initial evidence](boarding-party-playtest.md).

## Owner feedback addressed

Drake reported Boarding Gunner at check 10 was already tough, Bomber similarly difficult, and Life Support unreadable. The approved follow-up prioritizes more reaction time for the weapon stations, distinct realistic craft, committed diagonal approaches and stationary first-person interior defense. These reports are owner feedback, not final acceptance of the revised behavior.

## Checks

- `npm test`: **334 pass**. The suite preserves original eight-mode references and covers all Boarding difficulty bands/impairments, the exact 80/20 selection boundary, alternating ports independent of mine IDs, two-hit shuttles, one-mine kills, per-type reports, launch timing/flight guarantees, committed movement, chronological collisions/breaches, first-person depth/cover/laser timing, persistent fired bolts after kill/ejection, independent airlocks, terminal states, raw-frame substeps and lifecycle.
- `npm run build`: passes; the existing Phaser large-chunk advisory remains. `git diff --check` passes.
- Frozen-state rendering verifies finite fallback geometry, bounded image/text pools, label retirement when leaving Boarding Party, and partial/total texture failures. Existing save migration, import isolation and map encounter tests remain in the full suite; no save shape changed.
- The existing `scripts/browser-polish-check.cjs` covers all eight previous stations and map/library/scheduled encounter/save flows at desktop 1440px and emulated touch 390/320px widths.
- Updated `scripts/browser-boarding-check.cjs` covers all four stations at check **10 without Natural 1**, then retries with Natural 1. Desktop 1440×1100 and emulated-touch 390×844 / 320×844 verify actual keyboard/mouse/touch inputs, no firing from touch aim alone, separate Fire/mines/vent actions, independent cooldowns, pause/resize, report/retry, scheduled reveal/reload/explicit resume, page containment and no runtime/console errors in the main flow.
- Production-preview smoke checks at emulated 390×844 pass all four station launches, asset loading, pause/resume and page containment without runtime/console errors. Setup requests no artwork; the launched game loads eleven art files. A live, unstaged first-person screenshot was captured before its first incoming impact.
- Final WebP assets are decoded in Chromium; all five sprites retain alpha and the corridor decodes correctly. An isolated missing-art run blocks the six new textures and verifies first-person fallback graphics, labels, firing and vents remain usable. Network errors are expected only in that deliberate failure case.

Chromium runs through an existing Playwright installation because a Browser plugin was unavailable. Local Vite/Chromium required sandbox escalation. Temporary screenshots and JSON stay outside the repository under `/private/tmp/boarding-clarity-baseline`, `/private/tmp/boarding-clarity-after` and `/private/tmp/boarding-clarity-existing`. No private campaign save or canon source was used.

Screenshots stage readable threat/depth/laser fixtures; completion boundaries also use fixtures. Live inputs are exercised separately. These images and reports are not earned full-round scores or evidence of human balance. Actual iPhone/iPad Safari and physical multitouch remain untested.

## Calibration v0.7

The existing 288-sample-per-mode harness uses three profiles ×12 seeds ×4 bands ×2 Natural 1 states, 50ms steps and unchanged xorshift seeds/percentile convention. The original eight synthetic references and rating anchors remain fixed. Profiles now exercise the updated typed craft and first-person attack model without modifying check totals or adding scoring penalties.

| Mode | Samples | Min | P10 / low anchor | Median | P90 / high anchor | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Boarding Pilot | 288 | 54 | 68 | 198 | 900 | 900 |
| Boarding Gunner | 288 | 35 | 46 | 299 | 3220 | 4220 |
| Boarding Bomber | 288 | 35 | 46 | 561 | 1454 | 3863 |
| Boarding Life Support | 288 | 55 | 61 | 3100 | 4900 | 4900 |

These deterministic references establish reproducibility, not fairness. In particular, the engaged profiles approximate direct pointer aiming, not human/keyboard performance. Assess both gameplay pressure and advisory ratings with real completed/failed runs.

## Desktop performance and download cost

Rendering-only measurements below were collected for initial PR head `9c4b009`; the review follow-up changes simulation and collision timing without changing rendering/artwork. Matched before/after Chromium at 1440×1100, 180 animation-frame intervals per station, without builds/tests running. Before served an unchanged archive of the base revision; after served this branch. Staged busy scenes contain eight exterior craft or four interior boarders plus three lasers. Simulation was paused to compare rendering; this is not a real-device/live-game CPU profile.

| Station | Before frame median / P95 ms | After frame median / P95 ms |
| --- | ---: | ---: |
| Pilot | 8.3 / 10.0 | 8.3 / 10.1 |
| Gunner | 8.3 / 9.9 | 8.3 / 9.9 |
| Bomber | 8.3 / 9.7 | 8.3 / 9.7 |
| Life Support | 8.3 / 9.8 | 8.3 / 9.7 |

Small differences are measurement noise, not a claimed speedup. Artwork resource bytes rise from 81,826 to 288,756 (**+206,930**), requested only after game launch; setup still loads no art. Busy-scene pools stabilized at 11 images for exterior scenes or six images/nine labels for the staged interior. Mobile network, memory and actual Safari performance remain owner checks. [Artwork provenance, preparation and exact prompts](illustrated-artwork.md).

## Remaining owner checks

- [ ] Review/merge the follow-up PR; verify the successful automatic deployment revision before calling these changes live.
- [ ] At check 10, compare Gunner/Bomber with the original experience: opening time, warning visibility, reaction window, carrier-versus-interception decisions, mine reach and diagonal paths.
- [ ] Play every difficulty with/without Natural 1, including completed and failed runs. Judge fairness of the probe/shuttle mix, two-hit shuttles, Pilot density and new rating anchors.
- [ ] Confirm first-person cover/exposure, enemy advances, incoming lasers, damage direction and lit airlock bays are understandable without explanation.
- [ ] Test actual iPhone/iPad Safari: simultaneous aim/Fire/vent, rotation, background/resume, safe layout, image loading and full-round performance. Confirm desktop keyboard/mouse and report sharing.
- [ ] Keep #69–#72 and #39 open until explicit acceptance, tested revision and actual device/control coverage are recorded.

No merge, manual deployment, automatic consequences, synchronized state, friendly-fire system or new campaign material is included in this work.

## PR #74 review follow-up — carrier cycle transition

The P2 review finding was reproduced on `9c4b009`: advancing from 11.99 seconds moved the carrier from x=359.6 to x=240, taking Pilot hull from three to two despite both endpoints being clear. Before the fix, six of seven new regression tests failed; the legitimate-contact case already passed.

The follow-up completes the previous staging phase at its exact endpoint, captures that endpoint as the next cycle start, and locks the next target using the exact boundary timestamp and interpolated Pilot position/automatic prediction. Continuous movement segments now drive swept contacts across all phase changes. One carrier entity owns these segments, so shared endpoints cannot multiply blast damage. Controls, tuning, artwork, saves and encounter interfaces remain unchanged.

Eight focused regressions cover exact/straddled 12/24/36/48/60-second boundaries at 60Hz/30Hz/50ms, full-round continuity, one-time target locking, the phantom hit, legitimate contact, single damage at shared endpoints, and mine contact before expiry at approach/hold and withdrawal/staging turns. The full suite, build and seeded calibration are rerun. The table above reflects the corrected motion: Bomber's P90 anchor changes from 1917 to 1454; its low anchor, Pilot/Gunner anchors, Life Support and the original eight modes' references remain unchanged. v0.7 is retained while the PR is unmerged.

Focused Chromium checks use staged near-boundary states through the actual scene at desktop and emulated-touch widths. They verify the first two cycle transitions, retained hull for the reviewed clear Pilot, legitimate contact, single mine damage and pause/resume. They are synthetic boundary evidence, not owner or actual Safari acceptance. Temporary artifacts remain outside the repo under `/private/tmp/boarding-cycle-qa`.
