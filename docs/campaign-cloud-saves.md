# Private campaign cloud saves

On Sites, open **Galaxy Map → GM preparation → Private cloud saves**. Refresh the list and sign in if asked. Any signed-in account can manage its own private saves; permission to host Rooms remains separate. Local editing and backups still work without signing in or connecting to the server.

**Save local campaign as new cloud copy** captures the active campaign, all its maps, libraries, journeys and artwork. **Update selected cloud save** replaces the selected cloud revision after confirmation. Nothing uploads automatically. Local edits after a snapshot was captured need another explicit save.

On another device, refresh, choose a save and use **Restore as independent local copy**. Existing local campaigns remain intact. Restoring does not advance travel or resolve encounters. Local storage failures retain an exportable in-memory campaign; heed the recovery warning before leaving the page. Switching local campaigns during a restore discards the incoming result. Presentation does not contain the cloud panel or private campaign list.

If another device updated the save, a stale update or delete is rejected. Restore the latest cloud revision as another local copy to compare, save your own work as a new cloud copy, or export a recovery backup. **Retry same upload** retries the captured snapshot after a network failure without creating another save. Pending uploads exist only in memory; after reloading, refresh the cloud list before starting another upload. Signing in as a different account clears private selections.

**Download complete cloud backup** embeds artwork in compact version-2 JSON that can be imported on Pages without a network connection. Version-1 imports still migrate through the existing validator. The browser storage key and local archive format are unchanged. Missing or corrupt cloud artwork blocks a complete restore or export instead of silently producing an incomplete backup. Existing local copies remain available.

## Limits and storage

Cloud saves allow 20 active saves per account, 10 MB of reconstructed UTF-8 JSON per save, at most 100 maps with backgrounds per save, and 40 new upload operations in a rolling 24-hour window. Retries of the same operation do not consume another upload. Rate-limited new-copy attempts release unused reservations without removing interrupted uploads that can still be retried. Existing embedded PNG/JPEG/WebP validation and the 750 KB per-image limit still apply. Cloud limits do not change local archive validation. A rejected cloud save leaves local work unchanged and exportable.

D1 owns metadata, optimistic revisions and chunked map data. Private R2 objects store image bytes under server-generated keys. Only the Worker can reconstruct them after account ownership checks. Authenticated reads are not cacheable; mutating requests also require a same-origin Origin header and the current account fingerprint. Guest Rooms cookies do not authorize campaign access.

Content and art are staged before a D1 transaction publishes the new current revision. Interrupted uploads leave the previous complete revision readable. Operation IDs make retries idempotent; a mismatched payload cannot reuse one. Retired or abandoned revisions are reclaimed in bounded batches on subsequent writes by the same owner, after 24 hours. Delete hides a cloud save immediately and leaves local copies untouched; its stored content is eligible for that deferred cleanup. Tombstones retain only save metadata needed to prevent old requests resurrecting a deleted ID. There is no automatic background sync, version-history browser or cross-account sharing.

The Sites manifest adds `BUCKET` while retaining `DB`; the additive `0002_campaign_saves.sql` migration leaves Rooms tables unchanged. No new runtime secret is needed. The standalone Pages build has no cloud UI or API dependency. Do not change the Site audience or the player-link redirect as part of this feature.

## Owner checks

On the checked Sites PR version, use fictional campaigns and separate signed-in accounts:

- Save a campaign with linked maps, art and a paused encounter; restore it on another physical device and confirm an independent local copy.
- Compare two accounts' save lists and verify neither can read, update, download or delete the other's records or art.
- Edit from two devices and confirm a stale update is rejected. Retry an interrupted upload and export local work during an outage.
- Download a complete backup and import it on Pages. Verify the art and paused journey without cloud requests.
- Check actual iPhone/iPad Safari, keyboard focus, short-screen controls, sign-in return, delete confirmation and reload. Record revision and device coverage separately from Chromium emulation.

Issue #110 remains open through owner acceptance. No campaign content or example private exports belong in source or build assets.

## Engineering evidence — November 24, 2026

All 408 Node 22 tests pass. Checks cover private authorization, independent imports and legacy migration, optimistic concurrency, exactly-once save retries, interrupted R2/D1 writes, missing/corrupt art, expiration cleanup, save/daily quotas, Unicode chunk boundaries, client account changes and pending upload snapshots. Both Pages and Sites production builds and asset/Worker checks pass; the existing Phaser chunk-size advisory remains.

Production-Worker Chromium QA used fictional gateway identities and local SQLite/R2 substitutes at desktop and 320/390px touch-emulated sizes. It exercised save, second-device restore, artwork and paused journeys, stale updates, a discarded successful upload response followed by retry, two-account isolation, anonymous sign-in guidance, deletion, reload, local-storage quota failure with an exportable in-memory restore, discarding a restore after a local campaign switch, and a self-contained cloud backup imported into the standalone Pages build. Captures were inspected outside the repository. This is not physical Safari or hosted signed-in validation.
