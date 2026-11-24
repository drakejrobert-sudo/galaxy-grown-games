# Shared flight feasibility — issue #111

## Decision — November 24, 2026

**No-go for the hosted action prototype until a supported room coordinator is established.** This is the capability-gate outcome authorized in the implementation plan for [#111](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/111), not a completed multiplayer implementation or a claim that Sites can never support it. Keep the issue open. No shared-play UI, endpoint, migration, or new binding is introduced by this assessment.

The assessment starts from GitHub `main` revision `f71360c465cb9a71706b72619e85f75b3b3d7d3a`. Existing rooms coordinate assignments and explicitly submitted reports; each Flight Deck simulation still runs independently in its player's browser.

## Evidence and limits

| Requirement | Evidence inspected | Finding |
| --- | --- | --- |
| WebSocket transport | [Sites runtime limits](https://learn.chatgpt.com/docs/sites#understand-limits-and-unsupported-uses), accessed November 24, 2026 | HTTP, HTTPS and WebSockets are documented. A hosted upgrade was not attempted in this assessment. |
| One authoritative room across connections and instances | [Cloudflare WebSocket guidance](https://developers.cloudflare.com/workers/runtime-apis/websockets/), accessed November 24, 2026 | Multi-connection applications need a single coordination point; Cloudflare identifies Durable Objects as one implementation. Worker WebSocket support alone does not provide it. |
| Supported Sites provisioning | Installed Sites skill's hosting-manifest and storage references, plus the available native Sites tool schemas | D1 and R2 bindings are documented. No supported Durable Object or equivalent room-coordinator provisioning operation or manifest contract was found. This is an interface/documentation finding, not a hosted rejection or exhaustive platform capability test. |
| Repository deployment path | `.openai/hosting.json`, `scripts/build-sites.mjs`, `scripts/check-sites-worker.mjs` | The manifest declares `DB` and `BUCKET`. Packaging builds one Worker entry with embedded assets and copies the manifest and D1 migrations. No coordinator binding or coordinator deployment path exists in this source. Adding an invented manifest property would not establish provisioning. |
| Existing membership and ownership | `src/rooms/api.ts`, `src/rooms/types.ts`, `src/rooms/worker.ts`, `tests/rooms.test.ts` | DM ownership and cookie-backed guest seats are suitable foundations. They do not establish shared simulation authority, socket fan-out, or recovery. |

The installed Sites references are tool-environment evidence rather than portable repository dependencies. Future work should re-read its then-current Sites hosting and storage contracts; it must not depend on a personal filesystem path or assume that a newer platform has the same limitations.

An in-memory room registry can split when connections land in different Worker instances or disappear when an instance exits. D1 records and R2 files do not themselves provide a live room execution process. The approved scope excludes rapid database polling, browser-host authority, and external-service substitutions. A local echo server or two sockets that happen to share an isolate would not pass this gate.

## Conditions for reopening implementation

First obtain a supported Sites contract for provisioning and routing to a per-room coordinator, including lifetime/restart behavior and deployment packaging. A documented Durable Object binding would qualify; a general statement that Cloudflare supports Durable Objects would not establish that Sites exposes it.

After that contract is available, implement a minimal seat-authorized hosted coordination probe before gameplay. Verify same-origin upgrades, DM ownership, cookie-backed guest-seat access, room isolation, cross-instance routing to one authority, reconnect snapshots, and authority restart recovery. Use a checked feature-branch build and obtain explicit approval before publishing it under the deployment instructions supplied for this task. Preserve the designated test Site's audience and the player redirect.

Stop with updated evidence if the supported coordinator cannot be provisioned or the probe cannot establish one authority. Do not enable shared play on the strength of a local test. No external paid service is authorized.

## Agreed prototype after a passing gate

- Opt-in experimental room with exactly one Pilot and one Gunner; DM assigns seats and starts after both are ready. Preserve independent stations and Pages play.
- One shared 480×560 asteroid field, 60 seconds and three hull. Use fixed Easy difficulty without rolls, Natural 1 or campaign ratings. Pilot steers using existing Easy asteroid/Pilot tuning; Gunner uses direct touch/mouse targeting and the existing Easy firing cooldown. One hit destroys an asteroid; escaped asteroids do no damage. Resolve firing before movement/collisions and retain collision grace.
- Keep mechanics in the rules layer, rendering in the scene and controls in input. One coordinator owns elapsed time, entities, hits, hull and results. Clients send role-specific controls, never authoritative outcomes.
- Use a 30 Hz simulation, at most 20 input/snapshot updates per second, sequenced inputs, snapshot ticks and session identity. Interpolate rendering between authoritative snapshots.
- Either player's pause or background event pauses both. Heartbeats detect connection loss within three seconds. Clear held inputs; restore the latest authoritative snapshot on seat reconnect. Both players must be ready and the DM must explicitly resume. Room closure terminates access and traffic.
- Provide a copyable experimental report with elapsed time, hull, destroyed count and end reason. Campaign consequences remain manual. Do not reuse existing independent-mode rating anchors for shared play.

## Validation record and remaining checks

This deliverable changes documentation only. Browser gameplay QA is not applicable to these edits. No hosted probe was deployed, no new Sites version was created, and no two-player or physical-device test was performed. Existing hosting estimates do not measure this proposed workload.

Engineering checks on this documentation branch passed: `npm test` (410/410), `npm run build -- --outDir dist/pages`, `node scripts/check-build-assets.mjs dist/pages /galaxy-grown-games/`, `npm run build:sites` (including root asset and Worker checks), and `git diff --check`. Both client builds retain the existing Phaser large-chunk advisory. These checks validate the unchanged application baseline; they provide no shared-flight runtime evidence. No new automated tests were added for documentation-only changes.

| Gate | Current result | Required evidence before a go recommendation |
| --- | --- | --- |
| Supported coordinator provisioning | Not established | Published contract and successful supported deployment |
| WebSocket upgrade and seat authorization | Not tested hosted | Signed-in DM and separate guest browsers; unauthorized and cross-room attempts rejected |
| One authority and matching results | Not tested | Multi-instance routing/restart evidence, ordered/duplicate input tests and identical final state |
| Pause and reconnect | Not tested | Pause/background/disconnect/reload/reconnect tests; no stale firing or movement after explicit resume |
| Phone latency | Not measured | Actual iPhone/iPad Safari, device/OS/network details, and p50/p95 input-to-authoritative-update timing |
| Hosting usage | Not measured | 15-minute workload, GitHub SHA, Sites version, clients, message/byte/request counts and available credit measurements; unavailable metrics explicitly identified |
| Owner acceptance | Pending | Drake's explicit acceptance of the tested revision and applicable device coverage |

For a future go recommendation, require consistent state and safe interruption recovery, plus stable-network p95 input-to-authoritative-update latency at or below **200 ms**, a provisional target. Record desktop/emulated and physical Safari coverage separately. Do not infer one-way latency from unsynchronized device clocks; measure the originating client's input-to-acknowledged authoritative snapshot using its monotonic clock. Mark cross-instance behavior unverified if the platform provides no way to establish the test's instance coverage.

Future mechanics/network tests must cover deterministic simulation, role restrictions, duplicate/out-of-order inputs, cooldowns, collision ordering and exactly-once results. Run repository tests, both production builds, asset checks and Worker checks, followed by standalone Flight Deck/Map/Tanks regression checks when executable code changes. The separate dashboard workload in #116 does not substitute for shared-flight measurements.
