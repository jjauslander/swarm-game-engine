# Implementation decisions

5 November 2026 — Designer explicitly instructed execution of AGENTS.md and the initial brief. Prototype display name is Swarm Basic Prototype.

- Use a lightweight single npm project with packages/ source boundaries. Workspaces add no value yet; independent modules preserve the intended dependency direction.
- TypeScript/Pixi browser and Node HTTP authority. Network uses revisioned request/response and polling for a small turn game; no WebSocket dependency is required.
- JSON data packages with procedural visuals, fixed typed rules and trusted scheduled-operation registry. No untrusted scripts or arbitrary asset filesystem.
- Browser includes both examples and pure import validation, allowing local play without a running authority.
- Full replay comparison validates saves, including pending choices. This favors correctness at prototype scale; restoration cost is measured and grows with accepted history.
- Network replay IDs use opaque host IDs restored independently of deterministic local match creation.
- One complete selected package, exact dependency identities. No arbitrary rule-mod stacking.
- Basic local bots pursue collection/production using the same command interface. No old Competent policy was ported.
- Original geometry and post-playtest economy semantics guide the subset; initial setup and prototype objective are explicitly new.
- Host imports persist under .runtime, not tracked source. Browser-local imports persist in browser storage.
- Development checkpoints from pre-schema edits are quarantined rather than silently migrated.
- Initial dependency audit identified archive-parser/development-server advisories. Updated to fflate 0.8.3 and Vite 7.3.7; audit then reported zero vulnerabilities.
- Static routes and finite simple sounds preserve accessibility without an animation subsystem.
