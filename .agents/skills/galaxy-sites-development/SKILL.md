---
name: galaxy-sites-development
description: Develop and validate Galaxy Grown shared features on ChatGPT Sites, including the Rooms Worker, D1 schema, private test releases, and the standalone Pages build.
---

Read [AGENTS.md](../../../AGENTS.md) and the [Sites release guide](../../../docs/chatgpt-sites-pilot.md). Use the connected Sites capability for the designated test project and GitHub for reviewable source. Use the native Sites skill for current Worker, identity, storage, and packaging contracts.

- Keep both production builds green. Run `npm test`, `npm run build -- --outDir dist/pages`, `node scripts/check-build-assets.mjs dist/pages /galaxy-grown-games/`, and `npm run build:sites`. The Sites command builds the root-mounted client and checks the Worker artifact. Package only the Sites build from the checked source tree.
- Keep authorization in the Worker. Use the verified Sites account ID for ownership and membership and configure the DM account in Sites runtime settings. Apply schema changes through new D1 migrations under `drizzle/`. Test with fictional accounts and data.
- Use the private test URL and approved audience. Record the GitHub head, matching Sites source tree, version, deployment result, signed-in flows, and any remaining second-account or physical-device checks. Use [galaxy-playtest](../galaxy-playtest/SKILL.md) for browser evidence and standalone regressions. Follow the repository approval workflow for audience, redirect, and cutover changes.
