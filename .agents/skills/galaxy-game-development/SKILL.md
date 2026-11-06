---
name: galaxy-game-development
description: Implement or refine Galaxy Grown Flight Deck mechanics, rendering, input, and game UI. Use for the eight arcade modes; use galaxy-map-development for map work.
---

# Flight Deck development

Work from the repo root. Read [AGENTS.md](../../../AGENTS.md) and the current mode description in [README.md](../../../README.md). They own controls, balance, review and acceptance policy; historical playtest records may describe replaced controls.

## Locate the change

- `src/game/rules.ts`: simulation, collision ordering, scoring and balance. Find the mode's create/step functions and constants before editing mechanics.
- `src/game/input.ts`: held versus one-shot actions, pointer cancellation and keyboard normalization. Read the mode-specific input tests before changing gestures.
- `src/game/scene.ts`: rendering and bounded raw-frame integration. Keep warnings, HP/armor, targeting and cooldown overlays above decorative sprites. Art never supplies collision geometry. Reuse the image pool and retain procedural fallbacks.
- `src/main.ts`: setup, HUD, explicit pause/resume, lifecycle and reports. `src/game/runtime.ts` remains lazy; do not import Phaser or load game textures from setup.

Use `rg --files tests` and targeted symbol searches rather than loading every file. `tests/rendering.test.ts` has a frozen-state Graphics harness; `tests/frame-timing.test.ts` covers substeps and one-shot consumption; startup/resize tests cover lifecycle behavior.

## Validate and deliver

Add behavioral regression coverage, run `npm test` and `npm run build`, then follow [galaxy-playtest](../galaxy-playtest/SKILL.md) for graphics/controls. Test every mode sharing a changed renderer. Confirm unchanged simulation and collision dimensions when replacing art. Ship optimized assets with provenance; keep source generations and temporary captures outside public assets.

No personal plugins or model-specific APIs are required. Optional image tools may create original art; if unavailable, report that limitation instead of substituting unapproved external assets. Follow AGENTS.md through a reviewable PR, not a merge.
