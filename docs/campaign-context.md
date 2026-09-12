# Galaxy Grown — game development context

## Purpose and tone

These browser mini-games support Drake's D&D 5e sci-fantasy campaign, **The Grinning Gang and the Grown Galaxy**, set in **Galaxy Grown**. The setting mixes fantastical and technological worlds, space travel, strange characters, and playful, sometimes absurd adventures. Keep visuals adventurous, readable, and cohesive with that tone.

The Grinning Gang is an established antagonistic faction. The Placeless Pub is an established hub, owned by the Dragonborn Tervi Sclandervest. These references are background context, not instructions to add lore or NPCs to every game.

## Campaign ownership

The separate campaign repository is the authority for setting canon. Its user-provided local path is `/Users/drakerobert/projects/tggatgg/dnd_campaign_kdp_scaffold`; availability must be checked, never assumed. This summary comes from Drake's supplied project context, not a fresh inspection of that repository.

Authority: current explicit instructions, campaign CANON.md, dedicated lore/mechanics files, sourced session records, established material, then proposals. Keep global canon, shared world state, party-specific knowledge, and GM-only information separate. Never add secrets to this player-facing codebase.

Two parties share the setting: Corn Squad Cronies (CSC, virtual) and Dungeon Dummies (DD, in person). Games do not automatically synchronize party knowledge, resolve shared consequences, or change campaign records. The GM determines outcomes.

## Established game direction

Players enter their final skill-check total, including modifiers. Negative totals remain valid. Current bands: <=5 Hard; 6–10 Medium; 11–15 Easy; >=16 Very Easy. Natural 1 is recorded independently of the total and adds a role-specific impairment.

| Role | Natural-1 direction | Implementation status |
| --- | --- | --- |
| Pilot | Overloaded engine makes the ship move extra slowly | Asteroid Field prototype; 60% of difficulty-specific speed is provisional tuning |
| Gunner | Overheated gun fires at half its normal rate | Planned, not playable |
| Life Support | Extra overload icons and half as many heart icons | Planned, not playable |
| Bomber | Target has half its normal total area | Planned, not playable |

For a circular bomber target, halving area means multiplying radius by sqrt(0.5), not by 0.5. Do not implement the other roles merely because they are documented here.

Current pilot round: 60 seconds, three hull points, collision grace, pause/resume, and a manual score report. Numerical balance is provisional. Improving visual detail must preserve hazard visibility, responsive controls, and mobile performance.

## Publication boundary

Home-game history and publishable material are separate. Prefer original graphics and names for new game assets. Do not silently change campaign canon to accommodate publication, and do not assume outside references or homebrew are commercially cleared.
