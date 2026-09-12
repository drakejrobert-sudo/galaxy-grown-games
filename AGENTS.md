# Agent instructions — Galaxy Grown Games

## Start here

Read this file, README.md, docs/campaign-context.md, and relevant code and tests before editing. Inspect git status and fetch the current remote branch when possible. Preserve existing uncommitted work; use a separate worktree when appropriate. If a source or remote is unavailable, say so. Never claim to have read or updated inaccessible files.

## Required review workflow

- Always work on a descriptive feature, fix, or docs branch based on current main. Never commit or push directly to main.
- Make requested changes, run relevant tests and the production build, and open a pull request for Drake to review. A request to implement a change authorizes branch work and a reviewable PR, not a merge.
- Never merge a pull request, enable auto-merge, approve your own work, or bypass required checks. Drake reviews and performs the merge.
- Never deploy or trigger the deployment workflow without Drake's explicit approval of that deployment after review. Do not turn on automatic deployments as a convenience.
- Do not force-push shared branches or change repository permissions, branch protections, or review requirements without explicit instructions.
- Include the problem, user-visible changes, tests performed, known limitations, and a short playtest checklist in each PR. Report blockers honestly; a successful build is not browser QA.
- Stop at a concrete reviewable result. Do not repeatedly ask permission for ordinary implementation, fixes, tests, commits, or opening the requested PR.

These are agent workflow instructions, not GitHub branch protection. Do not claim server-side enforcement has been configured.

## Product and implementation

This repo contains player-facing browser mini-games supporting the Galaxy Grown campaign. Keep controls usable on phones, tablets, and desktop. Preserve speed limits for touch and keyboard alike, explicit pause/resume, readable hazards, and manual GM score reporting.

Keep simulation and balance in src/game/rules.ts, rendering in src/game/scene.ts, input in src/game/input.ts, and the UI shell in src/main.ts. Use the existing stack unless a change is requested. Keep unsupported roles visibly disabled rather than implying they work.

Difficulty comes from the modified check total. Natural 1 is a separate additional impairment. Preserve the established roll bands unless Drake explicitly changes them. Identify provisional numeric tuning as playtest values. Do not infer campaign outcomes from scores or grant items/upgrades automatically.

Add meaningful regression coverage for changed mechanics. Run npm test and npm run build. For visual or interaction work, attempt browser QA and document any blocked or untested flows, particularly iPhone touch controls. Avoid committing generated builds, dependencies, temporary QA artifacts, credentials, or private campaign material.

## Campaign boundary

Use docs/campaign-context.md for the limited player-safe context relevant to these games. This repo is not the campaign canon repository. Do not import transcripts, GM secrets, unpublished plot revelations, or party-specific discoveries into public source or shipped assets. New ideas are proposals until approved or established in play. Flag contradictions instead of silently rewriting lore.
