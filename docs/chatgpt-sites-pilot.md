# ChatGPT Sites pilot

The designated [private test Site](https://galaxy-grown-games-test.suppletarragon7.chatgpt.site) serves the root-mounted Vite client through a Sites Worker. Run `npm ci`, `npm test`, then `npm run build:sites` from the reviewed source. The package includes `dist/server/index.js` with embedded client assets, `dist/.openai/hosting.json`, and the D1 migrations. Use a clean Sites source checkout for packaging. CI checks the Pages artifact separately at `/galaxy-grown-games/`. Sites publication is independent of the Pages workflow and the play.drakesfood.com redirect.

### Rooms test setup

Configure `ROOM_DM_EMAIL` as a secret runtime value on the designated Site using Drake's verified ChatGPT email. The hosted gateway supplies identity, and the Worker stores stable Site account IDs for ownership and seat reclaim. The email and account IDs stay out of the browser and the repository. Sites applies the SQL migrations under `drizzle/` to its `DB` binding at publish time. Add future migrations as new SQL files and keep applied SQL immutable.

Drake opens **Rooms**, creates a room and copies its eight-character code. Rooms expire after 12 hours and can close earlier. A separately approved Site viewer signs in, enters the code and a display name, then receives a seat. Drake uses **Refresh rooms** to see the player and **Save station** to assign a role. The player refreshes to see it. Verify the seat returns on reload or a fresh session with the same signed-in account, and disappears when the room closes. Check two live rooms with fictional names and assignments. Room codes grant access to an in-game seat for players who already have Site access.

The Site origin has its own browser storage. Use the fictional demo for testing. The existing export/import controls can transfer a chosen campaign between origins. Treat archives and uploaded background art as private.

## Feasibility of shared play

| Feature | Existing game | Possible Sites extension and test |
| --- | --- | --- |
| Campaign saves across devices | Galaxy Map saves to local browser storage and exports v2 JSON with a v1 migration. | An optional Worker can associate D1 campaign records with the signed-in DM's Site user ID. Keep large private art in R2 behind owner checks. Preserve archive validation and export. Test a second device, a stale write rejected by revision, and isolation between two DMs. |
| Player room codes | Rooms use a Worker and D1 for expiring codes, seat reclaim and manual station assignments. | Verify two-account access, room isolation and reconnect on physical devices. |
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

1. Run the checks and open the PR with `Refs #N`. Build and publish the exact checked PR head to the designated private test Site. Record the GitHub SHA, Sites version, deployment result, hosted smoke result and Site URL in the PR or linked playtest record.
2. Drake signs in, tests the hosted revision and records acceptance with the applicable device and control coverage. If the build changes, publish the updated PR head and repeat the affected checks before merge.
3. Drake merges. Verify the automatic Pages deployment succeeded for the merge revision and contains the accepted changes. If the merged build differs from the accepted build, verify the affected behavior before closing the issue. Close after the deployment and all remaining issue criteria are recorded.

The stable player link currently uses Pages at https://drakejrobert-sudo.github.io/galaxy-grown-games/. Confirm it still reaches that build during the rehearsal. To reconcile an out-of-date private Site with Pages, identify the SHA from the latest successful Pages deployment and publish a root-mounted build of that source to the test Site.

Before moving the player link, exercise Flight Deck, Galaxy Map and Hillside Tanks on the hosted build, check player access from a second account with the intended permissions, and complete physical iPhone/iPad Safari playtests. Rehearse recovery with a fictional campaign exported from Sites and imported into the Pages build. Record the working Pages destination. Drake approves audience changes and the independently managed redirect cutover separately.

If a return to Pages is needed, verify the Pages revision and standalone flows, export any needed campaigns while Sites is accessible, and restore the approved redirect through the Drake’s Food infrastructure project with Drake’s approval. The two origins have separate browser storage. Shared rooms and future results or live sessions would require a backend to work on Pages.

## Suggested issues in priority order

1. **Validate the Sites release and rehearse cutover.** Add a root-path Sites build to CI alongside Pages. Exercise the hosted and recovery checks above before proposing the redirect change.
2. **Create DM rooms with expiring player codes.** A signed-in DM opens a room. Players with Site access join by display name, see their assignment and reclaim their own seat after a disconnect. Verify DM permissions and isolation with two simultaneous rooms.
3. **Collect station results in a DM dashboard.** Show encounter assignments and ready, playing and finished states. Let players submit their existing report explicitly and deduplicate retries. Refresh every five seconds during active rooms and measure hosting credits over a representative session. The DM decides consequences.
4. **Sync private campaign saves across devices.** Use D1 for DM-owned records and R2 for private art. Test a second-device restore, conflicting revisions, and a portable export with art that opens on Pages. Coordinate with [local-save acceptance](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/60).
5. **Prototype a shared pilot and gunner encounter.** After station rooms work, test a two-player encounter over WebSockets for consistent hits, pause, reconnects, phone latency and actual hosting usage before committing to synchronized flight.

These are proposed work items. Paid external services require Drake’s approval.
