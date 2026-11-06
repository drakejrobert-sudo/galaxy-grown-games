# Galaxy Map V1

Galaxy Map is a shared-screen, GM-operated travel prototype alongside Flight Deck. Open **Galaxy Map** in the app navigation (`#/map`). The fictional Lantern Sector is demo content, not campaign canon. Campaigns can contain multiple linked maps with independent journeys. The existing eight Flight Deck prototypes retain their controls, roll bands, Natural 1 behavior and manual result reporting.

## First journey

1. Select Lantern Haven, then **Add selected stop to course**. Select Cinder and add it; optionally add Echo Vessel. The course preview lists steps and risk. Select **Confirm course**.
2. Open **GM preparation** while screen sharing is stopped. Schedule **Drifting asteroid field** on leg 1, step 2; return using **Present to players**.
3. **Advance one step** checks travel once. Resolve any random encounter before advancing again. The scheduled field pauses at step 2, before arrival.
4. Copy the player challenge link. Each player opens it on their device, chooses their station, enters the requested roll and reports their score. No game starts automatically and the link carries no campaign data.
5. Record an optional outcome and **Resolve and resume**. Travel does not take another step until the GM advances it. VTT encounters simply pause for your already-open Maps session.
6. At intermediate destinations, continue or **End journey / replan here**. Ending is allowed only at a destination with no active encounter. At final arrival, plot another course from that destination.

On narrow screens the map scrolls horizontally to keep names and targets readable. The destination list provides standard keyboard/touch buttons as an alternative. Selecting a stop inspects it; **Add selected stop** appends it to the plotted course. Only adjacent stops may follow each other. Connections work both ways; ships are fixed destinations.

## Prepare your own sector

In **GM preparation**, create a named campaign from a blank map or the demo. Each campaign has a shared encounter library and weighted tables, plus named maps with independent destinations, routes, schedules, journeys and logs. Choose **Edit category** to author destinations, routes, encounter cards and weighted tables. Select an existing item to edit or delete it. To place a destination, click empty map space while its editor is open or enter coordinates (X 40–860, Y 50–450).

Create destinations, encounter cards and a table before connecting routes. New routes default to one abstract step and Medium risk. An encounter table's positive weights determine relative selection probability; zero excludes a card. Empty or missing tables produce no random encounter and appear under Route warnings. Referenced destinations/encounters cannot be deleted until their references are removed; deleting a table clears route assignments. The current destination cannot be deleted. Map edits are locked during that map’s journey; shared library edits are locked while any map has an active journey. End affected journeys at a destination first.

GM preparation shows **Insert encounter now**, plus scheduling by course leg and step. A schedule belongs to an occurrence of a route in that confirmed course, so revisiting a connection does not replay a previous schedule. Duplicate step schedules and scheduling in the past are rejected. Remove unused schedules in preparation. Starting a new course clears the previous schedule.

Each Advance checks the newly reached step for a scheduled encounter first. Otherwise the provisional random chance is **Low 10%, Medium 25%, High 50%**. A successful risk roll draws one card from the assigned table. Tables draw with replacement. Scheduled encounters replace that step's random check. Explicit resolution is required even on the last travel step; arrival waits for it. Inserting an encounter does not advance travel or consume a future check.

Preparation is presentation separation, not authentication. Future encounter cards, schedules, GM notes and the journey log are absent from presentation. Anyone with access to this browser profile can open preparation or inspect local storage. Stop screen sharing before opening it. Exported backups contain GM preparation data; treat them accordingly.

## Linked maps and reference markers

Use **Viewing map** to browse maps without changing a journey, location, schedule or travel log. Selecting a destination with a **Linked detail map** exposes **Open detail map**. The linked view offers a **Back to …** control for each map that links to it. Navigation clears unconfirmed course previews and editor selection; confirmed travel and paused encounters remain on their own maps. Reload restores the selected map. Travel does not automatically transfer between map scales.

In preparation, **Maps in this campaign** creates maps, edits their name/description and optional decorative orbital ellipses, or deletes them. Incoming destination links must be removed before deletion; the last map and maps with ongoing journeys cannot be deleted. Deleting a map removes its local travel history. Map descriptions are visible in presentation, so keep secrets out of them.

Destination types include **system** and **star**. Set **Travel access** to **Reference marker only** for inspectable landmarks that cannot become stops, route endpoints or the party location. Reference markers have dashed outlines. All markers remain selectable through the keyboard/touch destination list. Orbital ellipses are decoration, not routes or distances.

Mark speculative routes **Provisional proposal** to label their connections on the map. Their steps and risk remain editable; no table means no random encounter. No campaign geography or private starter package is bundled with the public app. Import private packages yourself and assess whether their visible geography is suitable before presenting to players.

### Optional illustrated backgrounds

In **Maps in this campaign**, use **Upload background** to select a local PNG, JPEG or WebP, or **Remove background** to return to the schematic. Background changes are locked during that map’s journey. Images sit beneath SVG routes, names, selection rings and the travel marker; they do not change destination coordinates or travel rules. With an image, schematic object symbols are hidden and outlines indicate selectable areas. The destination list remains available for touch and keyboard use.

Use text-free artwork aligned to the existing destination positions on a 900×500 logical map. Uploads up to 10 MB and 40 million pixels are fitted without cropping into an 1800×1000 image, with dark padding if proportions differ. Saved artwork is compressed to JPEG at no more than 750 KB. Unsupported, unreadable or excessive files leave the map unchanged. Changing maps during preparation of an upload discards that result rather than applying it to a different map.

Artwork is embedded in the browser save and campaign export; no image URL or public hosting is needed. Existing version 1/2 saves without images retain their schematic appearance. Imports allow embedded PNG/JPEG/WebP only, with the same 750 KB per-image cap. If an embedded image cannot be displayed, the schematic remains usable and preparation offers replacement/removal. Existing quota warnings and export recovery still apply; image-bearing saves consume more browser storage, and the overall 10 MB import limit still applies.

This proof has a single background per map. Per-object images, size/layer controls, zoom and a larger presentation view are tracked in [issue #67](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/67). Private campaign artwork and proof packages are supplied separately and are not shipped in the app.

### Save interface

Archive version 2 keeps `selected` and `campaigns`. Each campaign contains `id`, `name`, `activeMap`, `maps`, `encounters` and `tables`. Each map contains `id`, `name`, `description`, `decoration` (`none` or `orbits`), `destinations`, `routes`, `schedules`, `journey`, `location` and `log`, plus optional embedded `backgroundImage` (a raster data URL). Destination `navigable` defaults to true; optional `detailMapId` refers to a different map inside the same campaign. Route `provisional` defaults to false. Map IDs and entity IDs are local to their campaign/map. Imports assign new campaign IDs and preserve internal map links.

The existing `galaxy-grown-map-v1` storage key is retained for discovery and recovery of installed saves; the payload version is now 2. Invalid imports leave existing saves intact. Corrupt browser data stays untouched until explicit recovery, and failed writes leave an exportable in-memory campaign.

## Saves and recovery

Changes autosave in this browser, on this origin, under `galaxy-grown-map-v1`. There is no server or synchronization. Clearing site data, changing browser profiles, or using another device does not carry saves over. **Export this campaign** downloads a version 2 JSON backup containing every map, its travel state, the active map selection and the shared encounter library. Version 1 imports and existing browser saves are migrated to one map without changing their journey progress. Reading a legacy save does not rewrite its bytes; the next successful save writes version 2. Older app revisions cannot read version 2, so retain an existing version 1 export if you need to return to an older revision. Import validates all campaign references and journey state, then adds independent copies with new campaign IDs; it never replaces an existing campaign. Maximum import size is 10 MB.

Storage and quota errors display a warning. The current in-memory campaign remains exportable. If an existing save cannot be read, its bytes are preserved and autosaving is suspended; import a backup or explicitly replace the unreadable browser save from preparation. A failed import leaves existing campaigns intact. Delete campaign requires confirmation; deleting the last campaign creates a blank replacement.

## Engineering validation and owner checklist

Work items: Refs #60, Refs #61, Refs #62, Refs #63, Refs #64. PR merge does not close them. No campaign canon, actual coordinates, GM secrets or party discoveries ship with the demo. No fuel, ship capability calculations, automatic rewards/damage, moving destinations, cloud saves, multiplayer state or Maps API integration is included.

Automated regression coverage includes connected/bidirectional courses, multi-leg travel, exact risk boundaries, weighted draws, scheduled precedence and duplicate/past rejection, repeated route occurrences, immediate VTT pauses, encounter-gated arrival, save round trips and campaign isolation, invalid imports and storage failures, and private-data-free challenge links. Run `npm test` and `npm run build`; the pre-existing Phaser large-chunk advisory remains.

Desktop Chromium engineering checks passed against local Vite development and production-preview builds at 1440×1000 and an emulated 390×844 viewport. Browser plugin was unavailable; existing Playwright was used. These are not actual Safari/device checks. Temporary scripts, screenshots and exports remain outside the repository. The browser walkthrough exercises map and library creation, coordinate placement, weighted-table/route creation, disconnected plotting, multi-leg confirmation, random and scheduled encounters, minigame links, VTT pause, explicit resume, arrival/reload, separate saves, export/import, rejected imports, and Flight Deck prefill/launch/pause. It checks app identity, meaningful content, absent framework overlays, no runtime errors and no page-level horizontal overflow. An additional browser pass verifies edit/delete reference integrity, missing-table warnings, quota failure with an exportable in-memory save, corrupt-save preservation/explicit recovery, invalid situation fallback and hash navigation. All 246 tests passed; the production build passed with the existing bundle-size advisory.

The linked-map follow-up passes 255 tests and the production build (the same Phaser bundle-size advisory remains). Desktop Chromium at 1440×1000 and emulated touch at 390×844 verified private-file import, detail/back navigation, reference-only markers, preserved paused encounters across views/reload, shared-library locks, a completed journey, metadata editing, referenced-map deletion rejection, export/reimport isolation, rejected malformed imports, and a destination list that stays open across selections. Page identity, meaningful content, absent framework overlays, console/runtime health, screenshots and page-width containment passed. Browser plugin was not available; existing Playwright was used. Private fixtures, screenshots and exports remain outside this checkout; the public diff/build were checked for campaign-specific content. Actual iPhone/iPad Safari remains untested.

The optional-background proof passes 260 tests and the production build, retaining the existing Phaser bundle advisory. Desktop Chromium (1440×1000) and emulated touch (390×844) verified PNG/JPEG/WebP normalization, unchanged saves after unsupported/unreadable replacements, vector layering and keyboard/touch selection, per-map image isolation, travel-time upload locks, reload/arrival, embedded export/reimport and removal. An isolated deliberate corrupt-image check recovered to the schematic; an injected quota failure retained an exportable image-bearing campaign. Main-flow console/runtime, page identity, content, overlays, screenshots and page-width checks passed. Private artwork/proof data and QA artifacts stay outside the checkout. The proof does not establish actual Safari/device acceptance. Refs #67.

Before acceptance, Drake should:

- [ ] Review and merge the PR; verify successful automatic deployment and the deployed revision.
- [ ] On actual iPhone/iPad Safari and desktop, inspect/select stops, pan the map, plot/replan, and use the editors without clipped controls.
- [ ] Upload/remove a background, check readable labels and target alignment, then export/reimport the image-bearing campaign on actual Safari devices.
- [ ] Import a multi-map backup, open a linked detail map and return, verify reference markers cannot be travel stops, and reload a paused journey after switching views. Export/reimport both maps without changing the original campaign.
- [ ] Schedule a surprise without exposing preparation; trigger random and immediate encounters and verify pause, final-step arrival and explicit resume.
- [ ] Have the crew open Asteroid Field and Space Battle links on their devices; confirm role selection, roll entry and manual GM reporting.
- [ ] Run a Maps encounter, reload a paused journey, switch between party saves, and restore an exported backup.
- [ ] Assess travel length, risk probabilities and table weights as provisional playtest values. Record acceptance with revision and device/control coverage before closing the issues.

## Illustrated polish

Schematic maps now use original bundled scenery and destination illustrations, with schematic fallback if an asset fails. Uploaded map images still suppress bundled scenery and object icons. Selection brackets and pressed-state destination buttons distinguish selection from the current-position ring; reference markers remain dashed and labeled in the destination list. The legend explains these states. Paused encounter cards retain leg/step progress.

Selecting destinations and performing same-map actions preserves keyboard focus and horizontal scroll. If an action removes the focused control, focus moves to its surviving section heading or the map heading without scrolling. Browsing linked maps remembers horizontal positions independently by campaign/map until reload. These view preferences are memory-only and do not alter exports or saved journeys. This pass does not add per-object uploads, zoom, size/layer editors or an expanded presentation mode from #67.
