# Galaxy Grown — game development context

## Purpose and tone

These browser mini-games support Drake's D&D 5e sci-fantasy campaign, **The Grinning Gang and the Grown Galaxy**, set in **Galaxy Grown**. The setting mixes fantastical and technological worlds, space travel, strange characters, and playful, sometimes absurd adventures. Keep visuals adventurous, readable, and cohesive with that tone.

The Grinning Gang is an established antagonistic faction. The Placeless Pub is an established hub, owned by the Dragonborn Tervi Sclandervest. These references are background context, not instructions to add lore or NPCs to every game.

## Campaign ownership

The separate campaign repository is the authority for setting canon. Its availability must be checked, never assumed. This summary comes from Drake's supplied project context, not a fresh inspection of that repository.

Authority: current explicit instructions, campaign CANON.md, dedicated lore/mechanics files, sourced session records, established material, then proposals. Keep global canon, shared world state, party-specific knowledge, and GM-only information separate. Never add secrets to this player-facing codebase.

Two parties share the setting: Corn Squad Cronies (CSC, virtual) and Dungeon Dummies (DD, in person). Games do not automatically synchronize party knowledge, resolve shared consequences, or change campaign records. The GM determines outcomes.

## Established game direction

Players enter their final skill-check total, including modifiers. Negative totals remain valid. Current bands: <=5 Hard; 6–10 Medium; 11–15 Easy; >=16 Very Easy. Natural 1 is recorded independently of the total and adds a role-specific impairment.

| Role | Natural-1 direction | Implementation status |
| --- | --- | --- |
| Pilot | Overloaded engine makes the ship move extra slowly | Asteroid Field prototype; 60% of difficulty-specific speed is provisional tuning |
| Gunner | Overheated gun fires at half its normal rate | Asteroid Field prototype; direct touch/mouse pointer controls |
| Life Support | Extra overload icons and half as many heart icons | Asteroid Field prototype; one heart and two overloads per 12-packet Natural-1 cycle |
| Bomber | Mine blast target has half its normal total area | Asteroid Field prototype; radius scales by `sqrt(0.5)` so rendered and collision area are both halved |

For a circular bomber target, halving area means multiplying radius by sqrt(0.5), not by 0.5. Do not implement the other roles merely because they are documented here.

Current Pilot, Gunner, Bomber, and Life Support rounds last 60 seconds, support pause/resume, and produce manual score reports. Pilot, Gunner, and Bomber use three hull points; Life Support uses five system-integrity points. Gunner uses one direct pointer path for touch and mouse rather than keyboard reticle movement; difficulty scales through hazards, armor, and weapon cooldown. Bomber and Gunner fly automatically; players operate weapons, never ship steering. Bomber aims mines behind the ship and, in Space Battle, missiles ahead, using keyboard reticle movement or direct touch/mouse targeting with separate weapon buttons. Difficulty scales through hazard pressure. Pilot alone controls ship movement. Life Support routes power packets through a three-way switch; difficulty scales through packet speed and frequency. Numerical balance is provisional. Improving visual detail must preserve hazard visibility, responsive controls, and mobile performance.

## Publication boundary

Home-game history and publishable material are separate. Prefer original graphics and names for new game assets. Do not silently change campaign canon to accommodate publication, and do not assume outside references or homebrew are commercially cleared.
