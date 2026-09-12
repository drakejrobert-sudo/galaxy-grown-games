# galaxy-grown-games
A repository for hosting mini games for the galaxy grown campaign. 

## First playable slice

Asteroid Field / Pilot is implemented as a **prototype awaiting browser and device QA**. Other situations and roles are visibly disabled. Players enter their GM-requested final skill-check total and a separate Natural 1 flag, play independently, and manually share their score. No campaign data or live multiplayer service is included.

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
- Pilot engine impairment: **60% normal movement speed for this prototype**; exact balance is not GM-approved.
- Prototype round: 60 seconds, 3 hull points, 1.25-second collision grace period.
- Prototype score: rounded survival seconds × 10, plus 100 per remaining hull point. Maximum 900. This is not a cross-role scoring standard.
- Arrow keys/WASD steer; holding/dragging on the playfield steers toward a destination at the same speed cap. Touch never teleports the ship.
- Pause or Escape stops the round. Switching away automatically pauses; resumption is explicit.
- Final report includes check total, difficulty, natural-1 impairment, time, hits, hull, and score. Clipboard failure selects the report for manual copying. GM decides all outcomes.
- All art is simple original code-drawn geometry. No commercial game assets or GM-only lore are included.

### Architecture

`src/game/rules.ts` owns simulation and scoring. `scene.ts` renders it with Phaser. `input.ts` maps touch/keyboard to common movement. `main.ts` owns HTML setup, HUD, pause and reporting. This keeps additional situations and roles separate from the shell.

### GitHub Pages

The build targets `/galaxy-grown-games/`. The check workflow runs tests and builds on pushes and PRs. Deployment is manual: after review and merge, choose GitHub Actions as the Pages source in repository Settings → Pages, then run the **Deploy game hub** workflow from `main`. No deployment has been performed by this PR.

### Validation status

- Four automated tests pass: difficulty/input boundaries, modifier-versus-natural-1 movement, collision grace/failure, and successful completion/reporting.
- TypeScript check and Vite production build pass.
- Phaser produces a large-bundle advisory (~337 KB gzip); bundle optimization remains future work.
- Browser QA is blocked in the current environment: Cloud Browser refused the local preview with `net::ERR_BLOCKED_BY_CLIENT`. No rendered pass is claimed.
- Before merging, verify launch → movement → pause/resume → results → retry, copy fallback, viewport rotation, and touch behavior on iPhone/iPad Safari plus a desktop browser. Check for blank/error screens and console errors.

Progress toward issues #1, #2, #3, #4 and #12. These issues remain open pending browser/device validation, balance review, and (for #1) deployment.
