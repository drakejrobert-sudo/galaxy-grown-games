# Galaxy Map V1

Galaxy Map is a shared-screen, GM-operated travel prototype alongside Flight Deck. Open **Galaxy Map** in the app navigation (`#/map`). The fictional Lantern Sector is demo content, not campaign canon. The existing eight Flight Deck prototypes retain their controls, roll bands, Natural 1 behavior and manual result reporting.

## First journey

1. Select Lantern Haven, then **Add selected stop to course**. Select Cinder and add it; optionally add Echo Vessel. The course preview lists steps and risk. Select **Confirm course**.
2. Open **GM preparation** while screen sharing is stopped. Schedule **Drifting asteroid field** on leg 1, step 2; return using **Present to players**.
3. **Advance one step** checks travel once. Resolve any random encounter before advancing again. The scheduled field pauses at step 2, before arrival.
4. Copy the player challenge link. Each player opens it on their device, chooses their station, enters the requested roll and reports their score. No game starts automatically and the link carries no campaign data.
5. Record an optional outcome and **Resolve and resume**. Travel does not take another step until the GM advances it. VTT encounters simply pause for your already-open Maps session.
6. At intermediate destinations, continue or **End journey / replan here**. Ending is allowed only at a destination with no active encounter. At final arrival, plot another course from that destination.

On narrow screens the map scrolls horizontally to keep names and targets readable. The destination list provides standard keyboard/touch buttons as an alternative. Selecting a stop inspects it; **Add selected stop** appends it to the plotted course. Only adjacent stops may follow each other. Connections work both ways; ships are fixed destinations.

## Prepare your own sector

In **GM preparation**, create a named campaign from a blank map or the demo. Each campaign has its own map, encounters, schedules, journey and log. Choose **Edit category** to author destinations, routes, encounter cards and weighted tables. Select an existing item to edit or delete it. To place a destination, click empty map space while its editor is open or enter coordinates (X 40–860, Y 50–450).

Create destinations, encounter cards and a table before connecting routes. New routes default to one abstract step and Medium risk. An encounter table's positive weights determine relative selection probability; zero excludes a card. Empty or missing tables produce no random encounter and appear under Route warnings. Referenced destinations/encounters cannot be deleted until their references are removed; deleting a table clears route assignments. The current destination cannot be deleted. Map and library edits are locked during a journey; end at a destination first.

GM preparation shows **Insert encounter now**, plus scheduling by course leg and step. A schedule belongs to an occurrence of a route in that confirmed course, so revisiting a connection does not replay a previous schedule. Duplicate step schedules and scheduling in the past are rejected. Remove unused schedules in preparation. Starting a new course clears the previous schedule.

Each Advance checks the newly reached step for a scheduled encounter first. Otherwise the provisional random chance is **Low 10%, Medium 25%, High 50%**. A successful risk roll draws one card from the assigned table. Tables draw with replacement. Scheduled encounters replace that step's random check. Explicit resolution is required even on the last travel step; arrival waits for it. Inserting an encounter does not advance travel or consume a future check.

Preparation is presentation separation, not authentication. Future encounter cards, schedules, GM notes and the journey log are absent from presentation. Anyone with access to this browser profile can open preparation or inspect local storage. Stop screen sharing before opening it. Exported backups contain GM preparation data; treat them accordingly.

## Saves and recovery

Changes autosave in this browser, on this origin, under `galaxy-grown-map-v1`. There is no server or synchronization. Clearing site data, changing browser profiles, or using another device does not carry saves over. **Export this campaign** downloads a version 1 JSON backup. Import validates all campaign references and journey state, then adds independent copies with new campaign IDs; it never replaces an existing campaign. Maximum import size is 10 MB.

Storage and quota errors display a warning. The current in-memory campaign remains exportable. If an existing save cannot be read, its bytes are preserved and autosaving is suspended; import a backup or explicitly replace the unreadable browser save from preparation. A failed import leaves existing campaigns intact. Delete campaign requires confirmation; deleting the last campaign creates a blank replacement.

## Engineering validation and owner checklist

Work items: Refs #60, Refs #61, Refs #62, Refs #63, Refs #64. PR merge does not close them. No campaign canon, actual coordinates, GM secrets or party discoveries ship with the demo. No fuel, ship capability calculations, automatic rewards/damage, moving destinations, cloud saves, multiplayer state or Maps API integration is included.

Automated regression coverage includes connected/bidirectional courses, multi-leg travel, exact risk boundaries, weighted draws, scheduled precedence and duplicate/past rejection, repeated route occurrences, immediate VTT pauses, encounter-gated arrival, save round trips and campaign isolation, invalid imports and storage failures, and private-data-free challenge links. Run `npm test` and `npm run build`; the pre-existing Phaser large-chunk advisory remains.

Desktop Chromium engineering checks passed against local Vite development and production-preview builds at 1440×1000 and an emulated 390×844 viewport. Browser plugin was unavailable; existing Playwright was used. These are not actual Safari/device checks. Temporary scripts, screenshots and exports remain outside the repository. The browser walkthrough exercises map and library creation, coordinate placement, weighted-table/route creation, disconnected plotting, multi-leg confirmation, random and scheduled encounters, minigame links, VTT pause, explicit resume, arrival/reload, separate saves, export/import, rejected imports, and Flight Deck prefill/launch/pause. It checks app identity, meaningful content, absent framework overlays, no runtime errors and no page-level horizontal overflow. An additional browser pass verifies edit/delete reference integrity, missing-table warnings, quota failure with an exportable in-memory save, corrupt-save preservation/explicit recovery, invalid situation fallback and hash navigation. All 246 tests passed; the production build passed with the existing bundle-size advisory.

Before acceptance, Drake should:

- [ ] Review and merge the PR; verify successful automatic deployment and the deployed revision.
- [ ] On actual iPhone/iPad Safari and desktop, inspect/select stops, pan the map, plot/replan, and use the editors without clipped controls.
- [ ] Schedule a surprise without exposing preparation; trigger random and immediate encounters and verify pause, final-step arrival and explicit resume.
- [ ] Have the crew open Asteroid Field and Space Battle links on their devices; confirm role selection, roll entry and manual GM reporting.
- [ ] Run a Maps encounter, reload a paused journey, switch between party saves, and restore an exported backup.
- [ ] Assess travel length, risk probabilities and table weights as provisional playtest values. Record acceptance with revision and device/control coverage before closing the issues.
