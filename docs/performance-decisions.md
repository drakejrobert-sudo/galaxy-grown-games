# Phaser download decision — 2026-09-15

Related issue: [#26](https://github.com/drakejrobert-sudo/galaxy-grown-games/issues/26).

## Measurement and result

Run `npm ci` and `npm run build` with Node 22.12 or newer to reproduce the production chunk sizes. The figures below are from Vite 7.3.6 and Phaser 3.90.0 on 2026-09-15; generated `dist/` files are not committed.

| From current `main` | Initial setup JS | Deferred game JS | Total JS |
| --- | ---: | ---: | ---: |
| Before: minified | 1,268.37 kB | — | 1,268.37 kB |
| Before: gzip | 349.75 kB | — | 349.75 kB |
| After: minified | 40.19 kB | 1,229.96 kB | 1,270.15 kB |
| After: gzip | 12.17 kB | 338.70 kB | 350.87 kB |

The setup page now downloads **337.58 kB (96.5%) less gzip JavaScript** before a player starts a challenge. The total compressed JavaScript is 1.12 kB larger; Phaser has been deferred, not reduced. Vite still reports the deferred chunk above its 500 kB minified warning threshold. That warning remains enabled and is expected for this dependency.

A temporary Vite `generateBundle` inspection of `chunk.modules[*].renderedLength` found 8,276,043 bytes from `node_modules/phaser/` out of 8,311,222 rendered module bytes in the deferred chunk (**99.6% before minification**). The percentage describes Vite's module accounting, not compressed network bytes. The scene, rules, and input code are a small fraction of the deferred chunk.

The game uses Phaser's Canvas renderer, `Scene`, `Graphics`, and `Scale.FIT`/`CENTER_BOTH`. It draws its own geometry rather than loading shipped art. There is no application use of Phaser physics, tilemaps, audio, or WebGL features. The default Phaser import nevertheless brings its full distributed runtime into the game chunk.

## Options evaluated

- **Lazy loading:** Selected. The setup shell loads immediately; a valid Start challenge submission imports Phaser and the scene once. A visible loading message prevents repeat starts. Retry and mode switching reuse the same game instance. A failed download or synchronous startup restores the form for another attempt.
- **Phaser module/custom build:** Phaser [documents granular custom builds](https://phaser.io/devlogs/170), but that guide targets an older Phaser 3 version and webpack. The installed package includes source modules, while this app imports the distributed Phaser namespace and uses its types throughout the scene. Replacing it with a hand-maintained build would require verifying dependency closure, typing, Canvas rendering, scaling, and all six playable modes after each Phaser update. Phaser's [Compressor](https://phaser.io/news/2024/05/phaser-compressor-released) can omit unused systems but was announced as a subscriber tool. This PR keeps the pinned, supported package and avoids a custom runtime for an unmeasured gameplay-load benefit.
- **Caching:** The live `play.drakesfood.com` HTTPS shortlink responded with a 302 and `Cache-Control: no-store`. The GitHub Pages HTML and current hashed JavaScript asset each responded with `Cache-Control: max-age=600`, `ETag`, and `Vary: Accept-Encoding` on 2026-09-15. Browsers may reuse the hashed game asset during that interval, subject to normal cache validation; this does not remove its first-play download.

Cold-load timing on a real mobile connection/device was not measured in this session. Bundle bytes alone do not establish parse time or perceived first-challenge delay. The loading state makes that delay explicit, and real iPhone/iPad Safari playtesting remains an acceptance check for #26.

## Reevaluate when

Reconsider a smaller Phaser build if minified or gzip game bytes grow more than 10% above this baseline, a supported mobile device shows a noticeably slow first challenge, substantial assets or situations are added, or Phaser offers a maintained smaller build path. Keep Vite's warning visible until a separate, measured decision justifies a threshold with regression headroom.
