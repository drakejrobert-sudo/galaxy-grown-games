# Illustrated polish — engineering evidence

2026-11-06. Base revision: `c8efabf` (main). Refs #42, Refs #64, Refs #67. This pass preserves game rules, input, timing, scoring and the version 2 map save contract. It does not complete the broader zoom/visual-editor scope of #67.

## Visible changes

All eight modes receive illustrated space or engineering-bay scenery. Player/enemy ships and asteroids use textured sprites within existing logical footprints; precise gameplay feedback remains procedural. Maps add illustrated type symbols, a legend and selection brackets. Keyboard focus and horizontal scroll survive map updates, and scroll positions remain independent across linked maps/campaigns until reload. Encounter cards retain travel progress. Uploaded backgrounds continue to override bundled imagery.

Three portable repo-local skills guide game development, map development and engineering playtests. They reference existing instructions and tests, have no personal paths/plugin requirement, and leave model selection unchanged.

## Selected review screenshots

These are curated review evidence, not game assets. They use the public demo or normal game screens. Game captures show different live instants; they compare readability and style, not identical simulation trajectories.

| Surface | Before | After |
| --- | --- | --- |
| Galaxy Map, desktop | [Before](review/illustrated-polish/map-before.png) | [After](review/illustrated-polish/map-after.png) |
| Asteroid Gunner, 390px | [Before](review/illustrated-polish/gunner-before.png) | [After](review/illustrated-polish/gunner-after.png) |
| Space Life Support, 390px | [Before](review/illustrated-polish/interior-before.png) | [After](review/illustrated-polish/interior-after.png) |

## Automated and browser checks

- `npm test`: 281 passed. Rendering coverage exercises frozen simulation states across eight modes, pooled Images, retired sprite hiding, missing assets, asteroid diameter and reduced-motion Gunner hull alignment. Existing mechanics, collision, frame-timing, storage and migration coverage remains intact.
- `npm run build`: passed; existing Phaser large-chunk advisory remains. `git diff --check`: passed.
- Three skills passed the skill-creator frontmatter validator; relative reference links were checked. Their workflows route representative rendering, map-storage and QA tasks to the actual owning files/commands. No independent model benchmark is claimed.
- Desktop Chromium, 1440×1000 plus emulated-mobile 390×1000 and 320×1000: eight-mode launch, applicable keyboard/mouse controls, pause/resume, screenshots, content/console/overlay checks and page-width containment passed against local Vite. Map checks passed keyboard Enter/Space selection, retained focus/scroll, reference-only exclusion, detail/back navigation, independent campaign positions, scheduled encounter pause/resolution, arrival, reload, custom-image precedence, export/reimport and rejected imports.
- The production-preview browser matrix also passed at 1440/390/320px, adding emulated taps, resize/recovery and 615/617px Bomber rail checks. These remain desktop Chromium emulation, not actual Safari.
- Isolated texture checks: all artwork loaded, only the space background unavailable, and every game image unavailable. Game initialization and procedural fallback worked without runtime exceptions. The partial-load case retained sprites above the fallback background. Reduced-motion Gunner hull position matched the moving turret at a nonzero flight offset. Network 404s in these deliberately failed requests are expected.
- Results/copy/retry passed for all eight modes using terminal fixtures through the real scene/UI callbacks. These are synthetic completion checks, not earned full-round scores or owner balance evidence.

### Performance sample

Same host, headless desktop Chromium, 1440×1000, eight modes on Very Easy, 180 requestAnimationFrame intervals per mode, with no simultaneous build/test workload. Baseline was an isolated checkout of `c8efabf`; Vite dependency caches were separated. This is a short desktop sanity sample, not a statistically robust device benchmark or CPU/GPU profile.

| Measurement | Before | After |
| --- | --- | --- |
| Per-mode median frame interval | 8.2–8.3 ms | 8.2–8.4 ms |
| Per-mode p95 frame interval | 9.7–10.0 ms | 9.6–10.3 ms |
| Game artwork encoded bytes per fresh launch | 0 | 81,826 |

The complete eight-file artwork set is 128,498 bytes; maps request only their applicable assets. Short samples showed no substantial frame-interval regression. They do not establish sustained performance on slower hardware. Full-resolution generations, raw captures, synthetic exports and instrumentation remain outside the repository. An initial baseline launch failed because two dev servers shared a Vite dependency cache; separating caches resolved it before measurement. Browser-suite failures during development included asynchronous-import assertions and toggling an already-paused game; the final suite explicitly waits for state.

## Repeatable checks

Run `npm test` and `npm run build`, serve development or production preview, then use `node scripts/browser-polish-check.cjs` with `BASE_URL` set to the printed app URL. Playwright must be available; `PLAYWRIGHT_MODULE` optionally points to an existing installation. Set `QA_OUTPUT` outside tracked source. The script uses isolated contexts and synthetic campaign fixtures. It does not touch real GM saves. For performance comparisons, serve an unchanged baseline separately, measure the same browser/viewport/mode and capture at least 180 frame intervals after launch; run no other QA/build workload during collection.

## Remaining owner acceptance

- Review/merge the PR and verify the successful automatic deployment and revision before calling it live.
- Actual iPhone/iPad Safari: all eight modes, touch controls, portrait/landscape, readable hazards/armor/cooldowns, pause/app switch/resume, retry and reports. Check sustained performance and Hard + Natural 1 readability.
- Map: keyboard/touch selection, scroll retention, linked views, background upload/removal, encounter pause/resolve, export/import, and preparation privacy on the real presentation device.
- Assess artwork alignment, contrast, targeting clarity and gameplay feel. Existing balance/calibration gates remain unchanged. Record revision and device/control coverage before closing acceptance issues.
