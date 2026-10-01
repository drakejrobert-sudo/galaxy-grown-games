# Agent instructions — Galaxy Grown Games

## Start here

Read this file, README.md, docs/campaign-context.md, and relevant code and tests before editing. Inspect git status and fetch the current remote branch when possible. Preserve existing uncommitted work; use a separate worktree when appropriate. If a source or remote is unavailable, say so. Never claim to have read or updated inaccessible files.

## Required review workflow

- Always work on a descriptive feature, fix, or docs branch based on current main. Never commit or push directly to main.
- Make requested changes, run relevant tests and the production build, and open a pull request for Drake to review. A request to implement a change authorizes branch work and a reviewable PR, not a merge.
- Never merge a pull request, enable auto-merge, approve your own work, or bypass required checks. Drake reviews and performs the merge.
- GitHub Pages deploys automatically after a change reaches `main`, but only after the deployment workflow's tests and production build pass. Drake's decision to merge a reviewed pull request is approval for that automatic deployment. Do not manually trigger a deployment, deploy from another branch, or bypass its checks without Drake's explicit approval.
- Do not force-push shared branches or change repository permissions, branch protections, or review requirements without explicit instructions.
- Include the problem, user-visible changes, linked issues, engineering validation, known limitations, remaining owner checks, and a short playtest checklist in each game-change PR. Report blockers honestly; a successful build is not browser QA. Documentation/CI-only PRs should state when gameplay checks are not applicable.
- Completed engineering work can be ready for PR review while owner playtesting is pending. Use draft PRs for incomplete work or unresolved engineering blockers; pending owner acceptance alone does not require a draft.
- Stop at a concrete reviewable result. Do not repeatedly ask permission for ordinary implementation, fixes, tests, commits, or opening the requested PR.

### Code delivery and owner acceptance

For gameplay, graphics, controls, and other player-facing fixes, use this sequence: implementation → engineering checks → Drake reviews and merges → successful automatic deployment → Drake playtests → issue closure. Drake may merge reviewed, tested code so it becomes available to play while the related issues remain open for owner acceptance. A merge does not prove that deployment succeeded; verify the deployed revision before saying a change is live.

Use `Refs #N` to link game-change PRs to issues while owner acceptance is pending. Avoid GitHub closing keywords such as `Closes`, `Fixes`, or `Resolves` with issue references in PR descriptions and commit messages until acceptance is recorded, so merging does not automatically close those issues.

Close a player-facing game issue only after Drake explicitly accepts the affected changes and the issue's remaining acceptance criteria are satisfied. Record that acceptance, the tested revision, and applicable device/control coverage in the issue or a linked playtest record before closure. Merge, deployment, automated tests, and partial positive feedback do not establish full acceptance. Distinguish desktop/emulated checks from actual iPhone/iPad Safari evidence; retain any outstanding issue-specific gates.

Documentation and CI-only issues may close after review and applicable checks. This policy does not retroactively change existing issue/PR states or historical validation records.

These are agent workflow instructions, not GitHub branch protection. Do not claim server-side enforcement has been configured.

## Product and implementation

This repo contains player-facing browser mini-games supporting the Galaxy Grown campaign. Keep controls usable on phones, tablets, and desktop. Preserve speed limits for touch and keyboard alike when both are supported, explicit pause/resume, readable hazards, and manual GM score reporting. Asteroid Field / Gunner is an approved pointer-only exception: touch and mouse use the same direct aiming path, while difficulty comes from hazards, armor, and weapon cooldown rather than reticle speed.

Space Battle / Gunner has a separately approved reticle-speed exception: touch/mouse aim directly, while keyboard aiming is normalized and capped at 225 logical pixels/second. All inputs share identical firing cooldowns; reticle movement speeds are intentionally not equal. Touching/dragging its playfield only aims; a separate Fire button controls firing independently. Mouse movement aims and primary click/hold or Fire shoots. This design approval does not enable the unimplemented mode or change other modes' controls.

Keep simulation and balance in src/game/rules.ts, rendering in src/game/scene.ts, input in src/game/input.ts, and the UI shell in src/main.ts. Use the existing stack unless a change is requested. Bomber and Gunner never steer the ship: flight is automatic. Mines always release directly behind the ship in both Bomber modes, independent of aim. Asteroid Bomber only times mine releases. Space Battle Bomber has a separate forward missile reticle and independent mine/missile actions; keyboard missile aiming is normalized and speed-capped, while touch/mouse aim directly with the same weapon cooldowns. Preserve Pilot steering. Keep unsupported roles visibly disabled rather than implying they work.

Difficulty comes from the modified check total. Natural 1 is a separate additional impairment. Preserve the established roll bands unless Drake explicitly changes them. Identify provisional numeric tuning as playtest values. Do not infer campaign outcomes from scores or grant items/upgrades automatically.

Add meaningful regression coverage for changed mechanics. Run npm test and npm run build. For visual or interaction work, attempt browser QA and document any blocked or untested flows, particularly iPhone touch controls. Avoid committing generated builds, dependencies, temporary QA artifacts, credentials, or private campaign material.

When ChatGPT Work is being used from a mobile device, do not repeatedly attempt connected-browser QA against the local Vite server; that path has consistently been unable to reach the local app. Run automated tests and the production build, and leave real-device iPhone/iPad Safari checks as an explicit manual playtest item. Desktop or emulated-mobile browser QA may still be used when available, but label it accurately and never present emulation as real iPhone Safari verification.

## Campaign boundary

Use docs/campaign-context.md for the limited player-safe context relevant to these games. This repo is not the campaign canon repository. Do not import transcripts, GM secrets, unpublished plot revelations, or party-specific discoveries into public source or shipped assets. New ideas are proposals until approved or established in play. Flag contradictions instead of silently rewriting lore.
