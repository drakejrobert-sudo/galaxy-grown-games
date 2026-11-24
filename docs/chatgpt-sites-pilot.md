# ChatGPT Sites pilot

The private pilot uses the application from GitHub main revision `64eaa9d`, including Flight Deck, Galaxy Map and Hillside Tanks. The hosting manifest points to static Vite output. The GitHub Pages workflow continues to build for its repository path. For Sites, run `npm ci`, `npm test`, then `npm run build:sites` to produce a root-mounted `dist/`. Publish that output only to the test project specified in the manifest. The two builds use the same output directory, so package the intended build before running the other. Sites publication is independent of GitHub branches and the play.drakesfood.com redirect.

The pilot has no server bindings and uses only the application's shipped assets. The new origin starts with its own browser storage. Use the fictional demo for testing. The existing export/import controls can transfer a chosen campaign between origins. Treat archives and uploaded background art as private. Players would need access to the Site before an in-game invitation could work.

## Feasibility of shared play

| Feature | Existing game | Possible Sites extension and test |
| --- | --- | --- |
| Campaign saves across devices | Galaxy Map saves to local browser storage and exports v2 JSON with a v1 migration. | An optional Worker can associate D1 campaign records with the signed-in DM's Site user ID. Keep large private art in R2 behind owner checks. Preserve archive validation and export. Test a second device, a stale write rejected by revision, and isolation between two DMs. |
| Player room codes | The DM shares encounter links and players run stations independently. | Issue random, expiring room codes through a Worker. Enforce uniqueness, limit join attempts, and issue revocable player membership scoped to one room. A join code grants no DM permissions. Test expired codes, reconnects and room isolation. |
| Central DM dashboard | Players report scores manually. Hillside Tanks already supports play at a single DM-operated screen. | A DM-only view could read a room roster, round status and submitted results from D1. Start with explicit submissions and refresh only while the room is active. Deduplicate retries and require DM confirmation of consequences. Expose only player-safe fields to members. |
| Real-time sessions | Simulation, input, and rendering run in each browser. | Sites documents WebSocket transport. Shared action gameplay still needs an authoritative room process, message ordering, reconnect snapshots and fan-out across Worker instances. Verify supported coordination bindings, two-client latency, recovery and usage metering in a separate spike before promising synchronized play. Slow HTTP polling suits a scoreboard. |

Sites documents integrated database and file storage, hosted sign-in and WebSockets. These extensions have not been implemented or load-tested. [Sites runtime](https://learn.chatgpt.com/docs/sites) · [Data and connections](https://learn.chatgpt.com/docs/sites/data-and-connections)

## January 2027 hosting estimate

Hosting is free through December 31, 2026. From January 1, Plus includes 125 hosting credits per month shared across Sites. The approximate rates used here are 15 credits per 100,000 requests, 25 per storage-enabled Site-month, 150 per GiB-month of database storage and 3.75 per GiB-month of uploaded files. The default Sites address avoids the custom-domain fee. Building and editing use separate Codex usage. [OpenAI hosting rates](https://learn.chatgpt.com/docs/sites/usage-and-cost)

Assume one DM and five players, four three-hour sessions per month, one 40-request visit per browser per session, and no other traffic. The storage scenarios assume 10 MiB of database records and 100 MiB of uploaded art for the full month.

| Scenario | Monthly requests | Estimated hosting credits |
| --- | ---: | ---: |
| Static pilot | 960 | 0.14 |
| Shared saves, before extra reads and writes | 960 | 26.98 |
| Six clients also polling every five seconds while playing | 52,800 | 34.75 |
| Six clients instead polling every second while playing | 260,160 | 65.86 |

Five-second polling adds 6 × 4 × 3 × 3,600 ÷ 5 = 51,840 requests. Storage contributes about 26.83 credits per month. Cache behavior, other visits, writes, retention and traffic from other Sites change available headroom. The rate card does not establish a per-message WebSocket rate. Measure usage for a representative hosted session before budgeting real-time play.

## Owner smoke test

Open the private test origin while signed in. Launch a Flight Deck round and check art, pause/resume, and manual reporting. Open Galaxy Map, save a fictional campaign, reload, export and import it. Open Hillside Tanks and complete a turn. Repeat relevant controls on physical iPhone/iPad Safari. Hosted browser and device acceptance are pending.
