# Illustrated artwork

The eight WebP files in `public/art/` are original AI-generated sci-fantasy illustrations created for this repository with OpenAI's image-generation tool on 2026-11-05. No private campaign maps, third-party character designs, stock downloads or external asset services are included.

| Assets | Source brief | Shipping preparation |
| --- | --- | --- |
| player, enemy, asteroid, planet, station, star | Hand-painted navy/lavender friendly ship, coral hostile ship, cratered stone, teal planet, orbital station and amber star; top-down isolated 3×2 sprite sheet | Alpha-preserving crop to each object's visible bounds; 192×192 WebP at quality 0.84 |
| space | Subdued navy space with lavender/teal edge nebulae, empty center and a distant crescent; no text or foreground hazards | 1200×800 WebP at quality 0.84 |
| interior | Straight-on engineering-bay back wall, dark bulkheads and side pipes; no platforms, hazards, people or labels | 640×960 WebP at quality 0.84 |

The source sheet received a background-removal pass before preparation. Final assets retain transparency; original full-resolution generations are not shipped. Total artwork size is 128,498 bytes. The game requests five assets (81,826 bytes) only when its lazy runtime starts. Maps request their scenery and applicable symbols; setup loads no artwork. Browsers may reuse shared cached assets.

## Rendering contract

Artwork is decorative. Existing rule-owned collision radii, positions, hit ordering, cooldowns and targeting logic remain authoritative. Sprites fit the existing logical object footprints. Background images sit below background graphics; sprites sit below gameplay graphics. Procedural exhaust, mine previews, warnings, armor, HP, aiming and damage cues remain above artwork. Missing textures retain procedural rendering, including partial-load failures. Images are pooled and hidden when no longer needed.

Bundled map scenery and type symbols are not campaign geography. Local uploaded backgrounds retain precedence and suppress the bundled scenery/symbols. Routes, names, selection brackets, reference outlines and travel markers remain visible. Asset errors reveal schematic symbols instead of removing destination controls. No image fields or URLs were added to the campaign save format.
