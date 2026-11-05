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

## Game-rule separation — 5 November 2026

- Designer explicitly authorized the rule-separation brief. Earlier claims of generality were too broad: the initial core still contained Swarm semantics. Preserve that historical report and document this correction.
- Use a small typed trusted-module interface with module-owned validated state and declarative observations. Do not introduce an unlimited DSL.
- Runtime owns transactions, revisions, RNG/IDs, history and envelope identity. Modules own legality, resources, phases, continuation semantics, outcomes and policy.
- Explicit composition and instance registries replace global default flood registration. A second runtime can omit the Swarm module entirely.
- Source-artifact SHA-256 identity covers the transitive local TypeScript graph and common runtime. Generated constants are excluded to avoid circular hashing. Startup/build checks enforce matching source; this is not a downloaded-code signature or security sandbox.
- Schema 2 intentionally rejects schema-1 saves; reopen historical files at 2c6d11c. Preserve unavailable authority records on later persistence.
- Generic route/button affordances preserve Swarm staging and support Outpost without client rule branches. Browser testing found a pre-existing rapid-input/polling race; controls now wait for submission and stale/redundant polls do not overwrite interactions.
- The independent Signal Relay source starter proves a new action/resource/opposing choice/outcome through the same interface. Initial proof hashes were recorded before adding it. Later browser fixes and semantically verified formatting are documented separately.
- Outpost uses original procedural symbols and basic sounds, direct Scout ownership, fuel and participant turns. It is deliberately small; no franchise assets, combat, advanced AI or 3D were added.

## Guided onboarding — 5 November 2026

- Designer requested Play / Adapt / Create as the entry experience, with the assistant doing setup and guiding game design. They confirmed Claude Code in a local terminal or desktop app.
- Add root CLAUDE.md and a shared conversational guide. A user greeting starts the menu; a specific request skips it. Avoid full-rulebook questionnaires and redundant implementation approvals.
- Keep facilitation in the repository-aware coding assistant. Do not add an embedded model, account requirement or chatbot backend to the game.
- A dependency-free Node launcher installs/builds/serves using one command, verifies readiness, reuses matching builds and stops only its own identified server. Rebuild changed artwork/sounds as well as code.
- Local play links are the default. Cloud binding does not imply externally reachable preview; the assistant must verify the provider route.
- Extend the host with a lifecycle health endpoint and refresh its historical module-boundary hash explicitly for that change. Preserve original extension proof and game semantics.
- Record actual checks and untested Claude/provider interactions in docs/Guided_Onboarding_Build_Report.md.
