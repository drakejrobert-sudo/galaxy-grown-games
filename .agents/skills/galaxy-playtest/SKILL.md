---
name: galaxy-playtest
description: Verify Galaxy Grown games and maps in a browser, compare visual/performance evidence, and prepare an honest PR playtest record after player-facing changes.
---

# Engineering playtest

Read [AGENTS.md](../../../AGENTS.md) for acceptance and mobile-access constraints. Use Node matching `package.json`. Run `npm test` and `npm run build`; these are not browser QA.

## Setup

Use available Playwright, browser tools or manual control. Serve with `npm run dev -- --host 127.0.0.1`; use `npm run preview -- --host 127.0.0.1` for the production build. Open the printed URL including `/galaxy-grown-games/`. Report unreachable browsers; do not repeat the known mobile-to-local failure path.

Capture baseline screenshots before visual edits. Use isolated contexts so QA never overwrites a real GM save. When Playwright is installed, run `node scripts/browser-polish-check.cjs`. Optional `PLAYWRIGHT_MODULE` points to an existing installation; `BASE_URL` and `QA_OUTPUT` override URL/output. No personal path is hard-coded.

## Affected flows

- Shared game changes: all eight combinations; actual applicable controls, pause/resume, resize, retry, results and copy. For mechanics, include all bands with/without Natural 1. Synthetic state fixtures test rendering, not earned scores or balance.
- Map: pointer/keyboard selection, scroll/focus through updates, connected course, explicit advance, encounter pause/resolution and arrival. Visit linked maps without altering travel. Check reference markers, presentation privacy, background precedence/failure, reload, export/import and campaign isolation.
- Layout: desktop and 320/390px, plus around 616px for Bomber controls. Check overflow, clipped controls, warnings, console errors and framework overlays. Canvas work requires screenshot inspection. Label emulated touch separately from actual iPhone/iPad Safari.
- Performance: same mode/browser/viewport/sample duration before and after. Measure asset transfers and frame intervals separately from simulation time. Do not profile during builds/tests. Record pauses/stalls; desktop traces are not device performance evidence. Consult [performance decisions](../../../docs/performance-decisions.md) before speculative optimization.

## Evidence

Record revision, environment, exact flows, screenshots, failures and skipped checks. Include limitations and a short owner checklist in the PR, with `Refs #N`. Do not conflate engineering results with owner acceptance, close acceptance issues, merge or deploy.
