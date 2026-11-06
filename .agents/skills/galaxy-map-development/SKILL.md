---
name: galaxy-map-development
description: Develop Galaxy Map travel, linked maps, editors, presentation, artwork and browser-local saves. Use for map work rather than Flight Deck gameplay.
---

# Galaxy Map development

Read [AGENTS.md](../../../AGENTS.md), [campaign context](../../../docs/campaign-context.md) and [map behavior/save contract](../../../docs/galaxy-map-v1.md). Use synthetic fixtures, not private campaign exports.

## Owning modules

- `src/galaxy/model.ts`: travel and encounter transitions. Each map owns its journey; browsing never advances or transfers travel. Shared-library edits lock while any map travels.
- `src/galaxy/storage.ts`: validation, legacy migration, independent import copies and recovery. Preserve the storage key and archive contract unless migration is explicitly in scope. Failed imports leave saves untouched; failed writes retain an exportable in-memory campaign.
- `src/galaxy/background.ts`: local raster normalization and limits. Async uploads must not apply to a different campaign/map.
- `src/galaxy/view.ts` and `galaxy.css`: presentation, editors and binding. Unrevealed cards, schedules, notes and logs stay out of presentation markup. Hiding preparation is not authentication.
- `src/galaxy/view-state.ts`: ephemeral focus and per-map scroll state, never exported. Full-DOM renders must restore focus without scrolling or retaining detached elements.

Inspect `tests/galaxy-*.test.ts` for fixtures and the browser polish suite for DOM behavior. Reference markers remain inspectable but cannot be travel stops. User backgrounds take precedence over bundled scenery/icons, while labels and semantic feedback remain above both.

## Completion checks

Run `npm test`, `npm run build` and relevant [galaxy-playtest](../galaxy-playtest/SKILL.md) flows. Exercise preparation/presentation, linked-map navigation with a paused encounter, reload, export/reimport, malformed imports and artwork failures. Report save compatibility and remaining device acceptance. Use standard repo commands without depending on personal plugins or filesystem paths.
