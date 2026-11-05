# Swarm game engine — agent guidance

## Status and authority

The designer requested the initial engine implementation brief on 5 November 2026. The designer explicitly authorized execution on 5 November 2026: “Execute AGENTS.md and docs/Initial_Engine_Implementation_Brief.md through all acceptance gates. Use the original game as a read-only reference.” Implementation and actual verification are recorded in docs/Initial_Engine_Build_Report.md.

The initial build is recorded at commit 2c6d11c. It still contains Swarm-specific rules in the common runtime and is not yet a fully game-independent engine.

The designer requested [docs/Game_Rule_Separation_Implementation_Brief.md](docs/Game_Rule_Separation_Implementation_Brief.md) on 5 November 2026. It defines the next milestone: trusted game modules, preservation of both Swarm examples, and an independent Outpost Capture game. This brief is prepared for review; its implementation is not yet authorized. Do not infer build authorization from the request to write it.

Read both briefs before planning. Once the designer authorizes the rule-separation brief, it is the scope and acceptance contract for that milestone and supersedes conflicting initial architecture assumptions. Preserve the initial brief's required Swarm behaviour and read-only reference boundary. Latest explicit designer instructions take precedence; record substantive changes. Record the new milestone's implementation and actual verification in docs/Game_Rule_Separation_Build_Report.md.

The intended executing agent is Sol 6.1. No model-specific feature or account is a runtime dependency.

## Product boundary

This repository currently provides a moddable hex-board prototype with a bounded Swarm example and a second variant. The planned rule-separation milestone establishes game-independent rules through trusted modules. The first example uses earlier flat Pixi/HTML graphics and basic sounds. Full Swarm parity, richer 3D, advanced bots and public hosting remain outside the initial milestone.

The example package is named “Swarm Basic Prototype”. Its prototype-only production objective and reduced rules are specified in the brief; never present them as changes to the original game's accepted rules.

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
