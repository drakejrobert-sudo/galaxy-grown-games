# galaxy-grown-games
A repository for hosting mini games for the galaxy grown campaign. 

## First playable slice

Asteroid Field / Pilot, Asteroid Field / Gunner, Asteroid Field / Bomber, and Space Battle / Pilot are implemented as **prototypes awaiting balance and device QA**. Other situation/role combinations are visibly disabled. Players enter their GM-requested final skill-check total and a separate Natural 1 flag, play independently, and manually share their score. No campaign data or live multiplayer service is included.

### Run locally

Requires Node 22.12+.

```sh
npm ci
npm run dev
npm test
npm run build
```

Open the local URL printed by Vite, including `/galaxy-grown-games/`. If network-interface discovery is restricted in the environment, run `npm run dev -- --host 127.0.0.1`.

### Rules and provisional balance

- Modified totals: <=5 Hard, 6–10 Medium, 11–15 Easy, >=16 Very Easy.
- Natural 1 is an additional impairment, independent of the modified total.
- Pilot engine impairment: **60% normal movement speed**.
- Pilot round: 60 seconds, 3 hull points, and 1.25-second collision grace. Score is rounded survival seconds × 10, plus 100 per remaining hull point; maximum 900.
- Pilot controls: Arrow keys/WASD steer; holding/dragging on the playfield steers toward a destination at the same speed cap. Touch never teleports the ship.
- Gunner impairment: an overheated gun has **double the selected difficulty's cooldown**, producing half its normal sustained rate of fire.
- Gunner round: destroy incoming asteroids before they cross the defense line. Each impact costs one of 3 hull points. Armored asteroids take two hits and are introduced more often on harder difficulties.
- Gunner controls: tap, hold, or drag on touch screens; move the mouse to aim and click or hold to fire on computers. Both use the same Pointer Events path, direct reticle placement, and weapon cooldown; Gunner intentionally does not use keyboard reticle movement.
- Gunner score: 100 per destroyed asteroid, rounded survival seconds × 5, and 100 per remaining hull point. This is provisional and is not a cross-role scoring standard.
- Bomber steers through the upper portion of the field while pursuing asteroids travel upward through the mine trail. Arrow keys/WASD steer and Space/Enter lays mines; touch steering and the separate **Drop mine** control work simultaneously.
- Bomber mines arm after 0.25 seconds, last 5 seconds, and can be placed every 0.65 seconds. Contact detonates a mine and destroys asteroid centers inside its visible blast circle.
- Bomber Natural 1 reduces the mine blast radius by `sqrt(0.5)`, so both the drawn target and collision target have exactly half their normal area. The trigger remains a close-contact fuse.
- Bomber score: 100 per destroyed asteroid, rounded survival seconds × 5, and 100 per remaining hull point. The round ends after 60 seconds or when asteroid impacts deplete three hull points.
- Space Battle / Pilot starts with 18 seconds of fuel. Fuel drains at one second per second; each collected cell restores 8 seconds, up to a 30-second tank.
- Space Battle enemies cross the field and fire shots aimed at the ship's position when fired. Contact with a ship or shot removes one of 3 hull points, with 1.25 seconds of collision grace.
- Space Battle / Pilot ends after 60 seconds, at zero hull, or when fuel is depleted. Its score is rounded survival seconds × 10, plus 100 per remaining hull point and 50 per fuel cell collected.
- Space Battle / Pilot uses the shared keyboard/touch steering path. A Natural 1 applies the same overloaded-engine impairment: 60% of the selected difficulty's normal movement speed.
- Pause or Escape stops the round. Switching away automatically pauses; resumption is explicit.
- Final reports include the selected role, check total, difficulty, natural-1 impairment, role-specific statistics, hull, and score. Clipboard failure selects the report for manual copying. GM decides all outcomes.
- All art is original code-drawn geometry. No commercial game assets or GM-only lore are included.

### Architecture

`src/game/rules.ts` owns simulation and scoring. `scene.ts` renders it with Phaser. `input.ts` maps touch/keyboard to common movement. `main.ts` owns HTML setup, HUD, pause and reporting. This keeps additional situations and roles separate from the shell.

### GitHub Pages

The build targets `/galaxy-grown-games/`. The check workflow runs tests and builds on pushes and pull requests. After a reviewed pull request is merged, the **Deploy game hub** workflow runs on `main`, repeats `npm test` and `npm run build`, and deploys to GitHub Pages only if both pass. It can also be run manually from `main` when Drake explicitly approves that deployment. GitHub Actions must be selected as the Pages source in repository Settings → Pages.

### Validation status

- Twenty-six automated tests pass, covering the shared difficulty bands and lifecycle; Pilot touch/keyboard input and Asteroid movement/collisions; Gunner touch/mouse pointer input, cooldown, targeting, armor, impacts, scoring, and reporting; Bomber simultaneous movement/action input, mine placement and detonation, exact half-area impairment, impacts, scoring, and reporting; and Space Battle Pilot fuel, enemies, shots, collisions, all end conditions, impairment, tuning, scoring, and reporting.
- TypeScript check and Vite production build pass.
- Phaser produces a large-bundle advisory (~337 KB gzip); bundle optimization remains future work.
- Rendered browser QA is unavailable in the current environment because no compatible browser runtime is installed. No rendered Bomber pass is claimed.
- Before merging, verify Bomber launch → steering + mine placement → pause/resume → results → retry, copy fallback, viewport rotation, and touch behavior on iPhone/iPad Safari plus a desktop browser. Confirm that the Drop mine control does not obstruct the playfield and the blast circles match their collision behavior.

Issues #1, #4, #5, and #6 are complete. This branch implements #7 and continues progress toward the shared setup, controls, and reporting issues #2, #3, and #12.

### Development context and review

Read [AGENTS.md](AGENTS.md) for the required branch → pull request → Drake review workflow. Agents never merge or deploy autonomously. See [campaign context](docs/campaign-context.md) for the player-safe setting and role direction, and [ChatGPT project setup](docs/chatgpt-project-setup.md) for reusable project instructions.

### Proposed pilot balance update

All four difficulties now have faster, more frequent asteroids, inward diagonal drift, and occasional side-entry hazards with a 1.1-second edge warning. Harder settings add more cross-traffic and modestly reduce steering speed. Natural 1 still multiplies the selected speed by 0.6.

| Difficulty | Asteroid base speed (px/s) | Spawn interval (s) | Ship speed (px/s) | Side-entry chance |
| --- | ---: | ---: | ---: | ---: |
| Very Easy | 115 | 0.74 | 260 | 10% |
| Easy | 150 | 0.56 | 250 | 20% |
| Medium | 190 | 0.40 | 235 | 32% |
| Hard | 235 | 0.28 | 220 | 45% |

Visual additions use original procedural geometry: layered nebulae, parallax stars, a distant planet, rotating cratered asteroids with trails, a paneled ship with twin animated engines, and a collision-grace shield ring. Current balance still needs human playtesting, especially Hard with Natural 1 on touch screens.

### Proposed gunner balance

Harder checks send faster, more frequent hazards and introduce more two-hit armored asteroids. Easier bands also provide a shorter base weapon cooldown. Natural 1 doubles the listed cooldown without changing the selected difficulty.

| Difficulty | Asteroid base speed (px/s) | Spawn interval (s) | Fire cooldown (s) | Armored chance |
| --- | ---: | ---: | ---: | ---: |
| Very Easy | 110 | 1.10 | 0.28 | 0% |
| Easy | 135 | 0.90 | 0.32 | 10% |
| Medium | 160 | 0.72 | 0.36 | 18% |
| Hard | 190 | 0.55 | 0.42 | 30% |

Gunner balance, scoring, target tolerance, and armor frequency are provisional playtest values. Visual feedback includes an aim reticle, weapon-ready color, laser pulse, armored-health pips, a defense line, and impact flash.

### Proposed Space Battle pilot balance

Harder checks send faster, more frequent enemy ships; shorten their firing interval; speed up their shots; and provide fuel less often. Harder settings also modestly reduce steering speed. Natural 1 still multiplies the selected speed by 0.6.

| Difficulty | Enemy speed (px/s) | Enemy spawn (s) | Fire interval (s) | Shot speed (px/s) | Fuel spawn (s) | Ship speed (px/s) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Very Easy | 85 | 2.20 | 1.80 | 155 | 2.6 | 255 |
| Easy | 105 | 1.80 | 1.50 | 180 | 3.0 | 240 |
| Medium | 125 | 1.45 | 1.25 | 205 | 3.4 | 225 |
| Hard | 145 | 1.15 | 1.00 | 230 | 3.8 | 210 |

Space Battle fuel timing, enemy pressure, collision tolerance, and scoring are provisional playtest values. The mode still needs human playtesting on touch and desktop controls, especially Hard with Natural 1.

### Proposed Asteroid Field bomber balance

Harder checks send faster, more frequent pursuing asteroids with stronger inward drift. Bomber movement speed and mine cadence stay consistent across difficulties, while a Natural 1 halves the mine target area independently of the selected difficulty.

| Difficulty | Asteroid speed (px/s) | Spawn interval (s) | Ship speed (px/s) | Inward drift |
| --- | ---: | ---: | ---: | ---: |
| Very Easy | 115 | 1.12 | 225 | 0.28 |
| Easy | 140 | 0.92 | 225 | 0.38 |
| Medium | 170 | 0.74 | 225 | 0.48 |
| Hard | 200 | 0.58 | 225 | 0.58 |

Bomber hazard pressure, blast radius, mine cadence, scoring, and collision tolerance are provisional playtest values. The mode still needs human playtesting on touch and desktop controls, especially simultaneous touch steering and mine placement.
