# ChatGPT Sites pilot

The designated [public test Site](https://galaxy-grown-games-test.suppletarragon7.chatgpt.site) serves the root-mounted Vite client through a Sites Worker. Run `npm ci`, `npm test`, then `npm run build:sites` from the reviewed source. The package includes `dist/server/index.js` with embedded client assets, `dist/.openai/hosting.json`, and the D1 migrations. Use a clean Sites source checkout for packaging. CI checks the Pages artifact separately at `/galaxy-grown-games/`. Sites publication is independent of the Pages workflow and the play.drakesfood.com redirect.

### Rooms test setup

Configure `ROOM_DM_EMAIL` as a secret runtime value using Drake's verified ChatGPT email, and set `ROOM_RATE_LIMIT_KEY` to a random secret for network rate limiting. The hosted gateway supplies the DM's identity. Guests receive a browser cookie, and the Worker stores a hash for seat reclaim. The raw cookie, email, and account ID stay out of room responses. Sites applies the SQL migrations under `drizzle/` to its `DB` binding at publish time. Add future migrations as new SQL files and keep applied SQL immutable.

Drake opens **Rooms**, selects **DM sign in**, creates a room and copies its eight-character code. Players enter the code and a display name without signing in. Rooms expire after 12 hours, hold up to 16 seats, and can close earlier. Drake chooses one Flight Deck encounter per room and uses **Save station** for each player. The Rooms screen refreshes every five seconds in the foreground while it has an active room. Players see their assignment and open **Play assigned station** to enter their own check total and Natural 1. A new encounter uses a new room.

A seat shows **Ready** once the encounter and station are assigned, **Playing** after the player starts, and **Finished** after the player chooses **Submit to DM**. The encounter locks at the first start. Each station locks when its assigned player starts. The first report submitted for a seat stays on the DM dashboard, including after a retry. Players can still copy the report. The same browser retains the seat while the room is open. A different browser or cleared cookies require joining again.

For the public smoke test, use an account-free browser for each player and a signed-in browser for the DM. Check two live rooms, the assignment and status updates, a completed report, seat recovery after reload, and polling shutdown when the last room closes. Keep test names fictional. For the dashboard workload check, record one 15-minute run with one DM and four guests, with counts for room polls and other requests, plus metered hosting credits where available.

The Site now also uses the private `BUCKET` R2 binding and additive campaign-save D1 migration for [optional campaign cloud saves](campaign-cloud-saves.md). Cloud save access is restricted to the signed-in account matching `ROOM_DM_EMAIL`, with records still owned by its stable Sites account ID.

The Site origin has its own browser storage. Use the fictional demo for testing. The existing export/import controls can transfer a chosen campaign between origins. Treat archives and uploaded background art as private.

## Feasibility of shared play

| Feature | Existing game | Possible Sites extension and test |
| --- | --- | --- |
| Campaign saves across devices | Galaxy Map saves to local browser storage and exports v2 JSON with a v1 migration. | An optional Worker can associate D1 campaign records with the signed-in DM's Site user ID. Keep large private art in R2 behind owner checks. Preserve archive validation and export. Test a second device, a stale write rejected by revision, and isolation between two DMs. |
| Player room codes | Rooms use a Worker and D1 for expiring codes, seat reclaim and manual station assignments. | Verify signed-out guest access, DM authorization, room isolation and reconnect on physical devices. |
| Central DM dashboard | Players report scores manually. Hillside Tanks already supports play at a single DM-operated screen. | A DM-only view could read a room roster, round status and submitted results from D1. Start with explicit submissions and refresh only while the room is active. Deduplicate retries and require DM confirmation of consequences. Expose only player-safe fields to members. |
| Real-time sessions | Simulation, input, and rendering run in each browser. | Sites documents WebSocket transport. Shared action gameplay still needs an authoritative room process, message ordering, reconnect snapshots and fan-out across Worker instances. Verify supported coordination bindings, two-client latency, recovery and usage metering in a separate spike before promising synchronized play. Slow HTTP polling suits a scoreboard. |

Sites documents integrated database and file storage, hosted sign-in and WebSockets. Representative hosted load remains unmeasured. [Sites runtime](https://learn.chatgpt.com/docs/sites) · [Data and connections](https://learn.chatgpt.com/docs/sites/data-and-connections)

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

## Release and recovery

GitHub holds the reviewed source. Use this sequence for a player-facing PR.

1. Run the checks and open the PR with `Refs #N`. Build and publish the exact checked PR head to the designated test Site with its approved audience. Record the GitHub SHA, Sites version, deployment result, hosted smoke result and Site URL in the PR or linked playtest record.
2. Drake signs in, tests the hosted revision and records acceptance with the applicable device and control coverage. If the build changes, publish the updated PR head and repeat the affected checks before merge.
3. Drake merges. Verify the automatic Pages deployment succeeded for the merge revision and contains the accepted changes. If the merged build differs from the accepted build, verify the affected behavior before closing the issue. Close after the deployment and all remaining issue criteria are recorded.

The stable player link currently uses Pages at https://drakejrobert-sudo.github.io/galaxy-grown-games/. Confirm it still reaches that build during the rehearsal. To reconcile an out-of-date test Site with Pages, identify the SHA from the latest successful Pages deployment and publish a root-mounted build of that source to the test Site.

Before moving the player link, exercise Flight Deck, Galaxy Map and Hillside Tanks on the hosted build, check player access from a signed-out browser, and complete physical iPhone/iPad Safari playtests. Rehearse recovery with a fictional campaign exported from Sites and imported into the Pages build. Record the working Pages destination. Drake approves audience changes and the independently managed redirect cutover separately.

If a return to Pages is needed, verify the Pages revision and standalone flows, export any needed campaigns while Sites is accessible, and restore the approved redirect through the Drake’s Food infrastructure project with Drake’s approval. The two origins have separate browser storage. Shared rooms and future results or live sessions would require a backend to work on Pages.

## Suggested issues in priority order

1. **Validate the Sites release and rehearse cutover.** Add a root-path Sites build to CI alongside Pages. Exercise the hosted and recovery checks above before proposing the redirect change.
2. **Create DM rooms with expiring player codes.** A signed-in DM opens a room. Guests join by code and display name, see their assignment and reclaim their seat in the same browser. Verify DM permissions and isolation with two simultaneous rooms.
3. **Collect station results in a DM dashboard.** Show encounter assignments and ready, playing and finished states. Let players submit their existing report explicitly and deduplicate retries. Refresh every five seconds during active rooms and measure hosting credits over a representative session. The DM decides consequences.
4. **Sync private campaign saves across devices.** Use D1 for DM-owned records and R2 for private art. Test a second-device restore, conflicting revisions, and a portable export with art that opens on Pages. Coordinate with [local-save acceptance](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/60).
5. **Prototype a shared pilot and gunner encounter.** After station rooms work, test a two-player encounter over WebSockets for consistent hits, pause, reconnects, phone latency and actual hosting usage before committing to synchronized flight.

These are proposed work items. Paid external services require Drake’s approval.
