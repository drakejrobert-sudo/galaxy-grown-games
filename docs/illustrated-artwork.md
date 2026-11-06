# Illustrated artwork

The initial eight WebP files in `public/art/` are original AI-generated sci-fantasy illustrations created for this repository with OpenAI's image-generation tool on 2026-11-05. No private campaign maps, third-party character designs, stock downloads or external asset services are included.

| Assets | Source brief | Shipping preparation |
| --- | --- | --- |
| player, enemy, asteroid, planet, station, star | Hand-painted navy/lavender friendly ship, coral hostile ship, cratered stone, teal planet, orbital station and amber star; top-down isolated 3×2 sprite sheet | Alpha-preserving crop to each object's visible bounds; 192×192 WebP at quality 0.84 |
| space | Subdued navy space with lavender/teal edge nebulae, empty center and a distant crescent; no text or foreground hazards | 1200×800 WebP at quality 0.84 |
| interior | Straight-on engineering-bay back wall, dark bulkheads and side pipes; no platforms, hazards, people or labels | 640×960 WebP at quality 0.84 |

The source sheet received a background-removal pass before preparation. Final assets retain transparency; original full-resolution generations are not shipped. Total artwork size is 128,498 bytes. The game requests five assets (81,826 bytes) only when its lazy runtime starts. Maps request their scenery and applicable symbols; setup loads no artwork. Browsers may reuse shared cached assets.

## Rendering contract

Artwork is decorative. Existing rule-owned collision radii, positions, hit ordering, cooldowns and targeting logic remain authoritative. Sprites fit the existing logical object footprints. Background images sit below background graphics; sprites sit below gameplay graphics. Procedural exhaust, mine previews, warnings, armor, HP, aiming and damage cues remain above artwork. Missing textures retain procedural rendering, including partial-load failures. Images are pooled and hidden when no longer needed.

Bundled map scenery and type symbols are not campaign geography. Local uploaded backgrounds retain precedence and suppress the bundled scenery/symbols. Routes, names, selection brackets, reference outlines and travel markers remain visible. Asset errors reveal schematic symbols instead of removing destination controls. No image fields or URLs were added to the campaign save format.

## Boarding Party follow-up — 2026-11-06

Six additional original illustrations were generated with the built-in OpenAI image-generation tool for the approved follow-up. Exact prompts and transparency requests are recorded in [boarding-art-prompts.json](boarding-art-prompts.json). No external stock, franchise designs or private campaign sources were used. Full-resolution source PNGs remain outside the repository; final files are in `public/art/`.

| Final asset | Purpose | Dimensions | Bytes | Alpha |
| --- | --- | --- | ---: | --- |
| `boarding-carrier.webp` | Heavy graphite/coral carrier with launch bays | 177×256 | 18,640 | Yes |
| `boarding-probe.webp` | Compact unmanned docking probe | 103×256 | 10,882 | Yes |
| `boarding-shuttle.webp` | Armored crewed transport | 256×239 | 19,428 | Yes |
| `boarding-corridor.webp` | First-person corridor with open side bays | 640×800 | 95,268 | No |
| `boarding-boarder.webp` | Front-facing hostile rifle figure | 161×384 | 21,294 | Yes |
| `boarding-rifle.webp` | Player rifle and gloves in first person | 480×320 | 41,418 | Yes |

Preparation used alpha-preserving bounds cropping and browser-canvas resizing/WebP encoding at quality 0.88. Each transparent source was checked for genuinely transparent pixels; the five sprites retain alpha. The six files total 206,930 bytes; all fourteen shipped art assets total 335,428 bytes. The lazy game runtime now requests eleven files totaling 288,756 bytes. Setup still requests no artwork.

Craft radii/health, first-person target radii and attack timing are rule-owned and intentionally updated by this follow-up. Decorative detail adds no hit geometry. Sprites face committed travel directions. Warnings, health pips, lasers, feedback and text remain separate from art. The foreground rifle sits above cover; other sprites remain beneath feedback. Images and labels use bounded reusable pools, with retirement on mode changes and procedural fallbacks for missing individual assets.
