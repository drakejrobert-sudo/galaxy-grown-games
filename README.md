# galaxy-grown-games
A repository for hosting mini games for the galaxy grown campaign. 

## First playable slice

Asteroid Field / Pilot is implemented, and Asteroid Field / Gunner is a **prototype awaiting balance and device QA**. Other situations and roles are visibly disabled. Players enter their GM-requested final skill-check total and a separate Natural 1 flag, play independently, and manually share their score. No campaign data or live multiplayer service is included.

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
- Gunner controls: Arrow keys/WASD move the crosshair and Space fires. Holding or dragging on the playfield aims and fires with the same cooldown limit.
- Gunner score: 100 per destroyed asteroid, rounded survival seconds × 5, and 100 per remaining hull point. This is provisional and is not a cross-role scoring standard.
- Pause or Escape stops the round. Switching away automatically pauses; resumption is explicit.
- Final reports include the selected role, check total, difficulty, natural-1 impairment, role-specific statistics, hull, and score. Clipboard failure selects the report for manual copying. GM decides all outcomes.
- All art is original code-drawn geometry. No commercial game assets or GM-only lore are included.

### Architecture

`src/game/rules.ts` owns simulation and scoring. `scene.ts` renders it with Phaser. `input.ts` maps touch/keyboard to common movement. `main.ts` owns HTML setup, HUD, pause and reporting. This keeps additional situations and roles separate from the shell.

### GitHub Pages

The build targets `/galaxy-grown-games/`. The check workflow runs tests and builds on pushes and PRs. Deployment is manual: after review and merge, choose GitHub Actions as the Pages source in repository Settings → Pages, then run the **Deploy game hub** workflow from `main`. No deployment has been performed by this PR.

### Validation status

- Thirteen automated tests pass, covering the shared difficulty bands and lifecycle plus Pilot movement/collisions and Gunner keyboard/pointer input, cooldown, targeting, armor, impacts, scoring, and reporting.
- TypeScript check and Vite production build pass.
- Phaser produces a large-bundle advisory (~337 KB gzip); bundle optimization remains future work.
- Browser QA is blocked in the current environment: Cloud Browser refused the local preview with `net::ERR_BLOCKED_BY_CLIENT`. No rendered Gunner pass is claimed.
- Before merging, verify launch → movement → pause/resume → results → retry, copy fallback, viewport rotation, and touch behavior on iPhone/iPad Safari plus a desktop browser. Check for blank/error screens and console errors.

Issues #1 and #4 are complete. This branch implements #6 and continues progress toward the shared setup, controls, and reporting issues #2, #3, and #12.

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
