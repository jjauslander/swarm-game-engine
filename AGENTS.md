# Swarm game engine — agent guidance

## Status and authority

The designer requested the initial engine implementation brief on 5 November 2026. The preparation of these documents is not itself implementation authorization. On a subsequent instruction to execute the brief, proceed through its full acceptance gates.

Read [docs/Initial_Engine_Implementation_Brief.md](docs/Initial_Engine_Implementation_Brief.md) before planning or implementing. It is the primary scope and acceptance contract. Latest explicit designer instructions take precedence; record substantive changes.

The intended executing agent is Sol 6.1. No model-specific feature or account is a runtime dependency.

## Product boundary

This repository is a generic moddable hex-board engine with a bounded Swarm example and a second variant. The first example uses earlier flat Pixi/HTML graphics and basic sounds. Full Swarm parity, richer 3D, advanced bots and public hosting remain outside the initial milestone.

The prototype-only production-race objective and reduced rules are specified in the brief; never present them as changes to the original game's accepted rules.

## Original game reference

Reference: https://github.com/jjauslander/swarm-board-game
Known local checkout: C:/Users/jjaus/OneDrive/Documents/ChatGPT/Swarm-boardgame
Inspected revision: 6c57ddac2b2deaf4fc62df2b6a7a0ce1705d712a

Use the reference read-only for rules, code, historical flat art/basic sounds and regression scenarios. Read its instructions and relevant rule briefs before adapting behaviour. Do not modify its game, rewrite its history or make this engine depend on its checkout. Use a separate clone if needed. Record exact reused revisions, adaptations and licenses.

## Engineering contracts

- Keep simulation independent of DOM, rendering, network, filesystem, wall-clock time and ambient randomness.
- Separate participants, controllers, owned areas, scheduled activations, current decisions and complete action transactions.
- Keep pending decisions serializable and recoverable. Validate all commands at the authority.
- Use stable tile identities independent of rendered coordinates.
- Pin package versions/digests for active matches and saves.
- Give humans, bots and external agents only permitted information.
- Keep package-specific rules/assets outside generic engine and client branches.
- Use structured importable packages; arbitrary downloaded executable scripts are deferred.
- Build CLI and MCP as wrappers over the same tested modkit services.

## Working practice

Inspect the current worktree and preserve unrelated changes. Make routine implementation choices independently; do not repeatedly seek approval already provided by the execution request. Report material scope conflicts before changing the agreed product.

Implement in stages from the brief. Maintain docs/Decisions.md, docs/Reference_Mapping.md and docs/Initial_Engine_Build_Report.md as work proceeds.

Run relevant unit, integration, real MCP transport, network and browser checks. Run clean install/build and full relevant suites before completion. Record exact commands/results; never imply unrun tests passed. Measure performance using reproducible fixtures. Phone viewport checks do not establish physical-device performance.

After implementation is authorized, make meaningful verified commits and push to the tracked repository. Do not force-push or commit dependencies, build output, secrets, temporary checkouts or unrelated assets.

Final delivery must distinguish implemented/tested prototype capabilities, deferred full-game features, outstanding limitations and designer acceptance.
