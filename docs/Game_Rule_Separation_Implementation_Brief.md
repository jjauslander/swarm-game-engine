# Game-rule separation — implementation brief

Revision 1 · 5 November 2026 · Prepared for execution with Sol 6.1

## 1. Status and intended result

This brief is the planning deliverable requested by the designer after discussing how another person could clone this repository and build a different game. Preparing, committing or publishing this document does not authorize implementation. Start implementation only when instructed to execute this brief.

Target: https://github.com/jjauslander/swarm-game-engine
Inspected baseline: 2c6d11c0e3ca86508ae36d956736922103374e93.
Original Swarm repository remains a read-only reference.

The intended result is straightforward: the engine provides the board, command processing, turns, recoverable choices, history and networking; each game supplies its own resources, actions, decisions, turn events and winning conditions.

The current implementation provides a useful working prototype and authoring workflow, but still embeds Swarm semantics in engine types, execution, client controls and bot policy. Passing the original tests did not prove general game-rule independence. This milestone closes that gap; do not describe merely renaming pollen to fuel as achieving it.

Preserve Swarm Basic Prototype and Garden Cycle. Add a genuinely different, small space-themed game called **Outpost Capture**. Use original names, symbols and flat colours; licensed franchise artwork is unnecessary. The designer's Star Wars example expresses the desired ability to change theme, map, rules and objectives.

Once authorized, execute through every acceptance gate, fix failures and report evidence. Routine design choices do not require renewed approval. Designer playtesting, visual/audio approval and physical-device acceptance remain separate.

## 2. Read before changing code

Read AGENTS.md, the initial implementation brief, its build report, README, Architecture, Package_Format, Modding_Guide, Decisions and the current tests. Inspect Git status and preserve unrelated work.

Audit these concrete coupling points:

- packages/engine/types.ts: pollen, queen/resource flags, production/departure/capacity decisions, support/products/goal/flood fields, phases and single-winner assumptions.
- packages/engine/index.ts: collection, cargo/support, Queen visits, production, free departure, capacity resolution, scheduling and outcome evaluation.
- packages/engine/extensions.ts: globally registered flood operation and its Swarm-specific context.
- packages/client/main.ts: hive setup, bee selection, route staging, production controls, summaries and outcome wording.
- packages/client/simple-bot.ts: Flower/Queen targeting and Honey preference.
- Package validator, host setup and persisted match format, modkit simulation, CLI/MCP templates, example generator and browser-local catalogue.

Record an extraction map before refactoring: existing responsibility, destination, preserved behavioural tests. Do not copy the old executor wholesale into a supposedly generic extension API while leaving its state shape mandatory for every game.

If reference rules require inspection, follow the original repository's instructions and record the revision. Never modify that checkout or introduce a dependency on it.

## 3. Scope and explicit limits

Required:

1. A pure, game-independent runtime and versioned trusted game-module interface.
2. Package-owned rules, state validation, legal actions, decisions, scheduling policy and outcomes.
3. Generic presentation and controller contracts sufficient for both game families.
4. Existing Swarm prototype behaviour preserved inside its own module.
5. Garden Cycle retained as a variant using that module.
6. Outpost Capture playable locally, by a simple bot and through the existing authority.
7. Data-mod and source-module authoring workflows with truthful CLI/MCP capability reporting.
8. Save/replay identity extended to include executable rules, with explicit compatibility failures.
9. Automated isolation, correctness, network, browser, tooling and performance evidence.

Deferred: full Swarm parity, advanced AI, card-game UI, fog of war, arbitrary hidden board entities, dynamic board rearrangement during a match, 3D, arbitrary imported scripts, a rule-editor GUI, universal rule DSL, marketplace, accounts and public hosting.

Static alternative hex layouts and logical connections are required. Keep tile identity separate from position and validate graph relationships; do not add rotating/moving boards.

## 4. Separation of responsibilities

The runtime owns:

- Stable participant, entity, area and tile identities; generic topology helpers.
- Authority revisions, authenticated command dispatch and duplicate/stale-command handling.
- Deterministic RNG and ID allocation through controlled services.
- Transaction snapshots, serializable continuations, history and undo enforcement.
- Bounded consequence execution, event ordering and outcome finalization.
- Save envelopes, rule-module resolution and replay infrastructure.
- Observation/event filtering infrastructure and transport-neutral controller contracts.

The game module owns:

- Setup constraints and starting state.
- Game-specific entity attributes, resource definitions and validated configuration.
- Legal actions, action costs, movement restrictions and consequences.
- Choice ownership/options and the continuation after a response.
- Activation order, budgets, phases and start/end/round rules.
- Victory/draw rules and undo restrictions where necessary.
- Observable labels, counters, prompts, instructions and semantic event meanings.
- Optional bounded bot policy operating on permitted observations.

The host and client resolve modules through shared explicit composition, never through game-name conditionals. Engine code must not import a game implementation. Neutral topology helpers are reusable; Flower collection, Queen departure and support calculations are not neutral runtime services.

Keep ownership, controller, origin, physical territory and decision owner distinct. Do not impose Swarm's origin-area ownership model on every future entity: a game may use explicit participant ownership or derive it from an area.

## 5. Trusted module contract

Use a small typed TypeScript interface, not a universal language. Choose exact names during implementation and document them. It must cover:

- Module identity, API compatibility and config/state schema versions.
- Configuration/setup validation and match initialization.
- Legal-action descriptions for the requesting participant.
- Validated action/decision resolution and automatic consequences.
- Validation of game state and pending continuations.
- Participant observation, visible events, status and outcome presentation.
- Optional controller policy and package-specific presentation descriptors.

Use explicit input/output types and runtime validation at package, save and command boundaries. Game data must be JSON-serializable; avoid unvalidated any blobs as the extension contract. Namespaced, module-validated JSON is acceptable without prescribing a heavyweight schema library.

A minimal shape may separate runtime state from game state and provide initialize, validate, actions, resolve and observe hooks. Alternatives are acceptable if the required behaviours remain testable. Keep the public interface small and publish a worked example.

Authority supplies actor identity. Module hooks cannot make the submitted actor trustworthy merely by reading a payload field. Verify that the action is legal in the current authoritative state, including its complete parameters.

No simulation hook reads the DOM, filesystem, network, clock or ambient randomness. Provide RNG and ID services; queries/projections must not advance them. Stable ordering and deterministic tie-breaking are required.

Execute against isolated draft state. On an invalid command, thrown hook error, invalid result or exceeded consequence budget, publish no partial state, RNG advancement, events or history. Bound queued work and bot search. Trusted synchronous source code cannot be safely preempted if it never returns: document this limitation instead of calling the interface a sandbox.

Registration must be explicit, reject duplicate identities and API mismatches, and work in isolated runtime instances. Tests for one game must not depend on global registration order or leak operations into another.

## 6. Decisions, actions and outcomes

Replace the production/departure/capacity union in generic contracts with module-defined decision kinds and validated plain-data payloads. Each decision retains its ID, revision, owner, prompt and supported options. Continuation state is serializable data; no closures, stacks or callbacks in saves.

One action can pause for another participant, resume, request another choice and finish as a single transaction. Swarm's visitor → Queen-owner production → visitor departure sequence must continue working, including zero-AP departure.

The runtime must know whether a transaction is open, paused or settled without knowing what a Queen is. An outcome proposed by a module becomes final only at a valid settled boundary. Outcome data supports winner lists and a draw, with a structured reason; preserve Swarm's existing single-winner behaviour.

Generic commands may include submitting an action, answering a decision and undoing. End-turn, deploy, claim, attack or trade belong to a game's action set; no mandatory movement/end-turn command catalogue hard-coded into the runtime.

Modules decide resource costs, phases and activation policy. The runtime can supply reusable scheduling primitives, but must support both Swarm's separate per-hive activations and Outpost Capture's per-participant turns. A system participant remains available without occupying a human seat.

Undo still reverses a completed local action and all consequences. Network and hidden-information restrictions remain authority-enforced. A module may make an action non-undoable; generic Undo must respect that.

## 7. Presentation and controllers

Give the generic client a validated projection containing board cells, visible entities, symbols/colours, player/status counters, action affordances, decision controls, outcomes and help. It must not inspect raw module state to reconstruct legality.

Support practical default controls:

- Select a piece and choose a destination/path when an action exposes those targets.
- Choose an action button or accessible list entry.
- Select a decision option and see who must respond.
- Display labelled counters and phase/turn information without fixed pollen/AP/hive names.
- Render package symbols, colours, highlights and event-to-synth-cue mappings.

Use declarative, validated presentation descriptors. Imported packages cannot provide HTML, executable render callbacks or arbitrary scripts. Preserve Swarm's two-segment staging, finish/cancel behaviour and keyboard/touch route selection through a reusable staged-action affordance. UI previews do not mutate authority or spend resources.

Generic setup supports module-described bounded fields and ownership constraints. Swarm still configures two to six players/hive allocation; Outpost Capture offers exactly two sides. Hide controls unsupported by the selected game.

Move the Flower/Queen bot into the Swarm module's controller support. Provide a deterministic generic legal-choice fallback and an Outpost policy that can finish a seeded match. Controllers use only their permitted observation/options. Do not pass full authority state to a game-specific bot under the label of an observation.

Keep audio unlocking, mute/volume, event deduplication, camera controls, resource disposal and menu/live-match return working. No historical sounds on reconnect, load or Undo.

## 8. Rule identity, archives and saves

Distinguish two authoring routes clearly.

**Data package:** changes maps, values, appearance and behaviour already supported by an installed game module. It remains importable as a data-only .hexmod.

**Trusted source module:** introduces new mechanics in developer-controlled TypeScript source, using the documented interface. It requires explicit registration and a build for local browser, host, simulation and test environments. Rebuilding is expected; editing generic engine/client/host logic is not.

Downloaded .hexmod archives must never automatically install or execute code. If the required module is absent or incompatible, validation/import reports the missing identity and how to install a trusted matching build. No dynamic arbitrary URL imports.

Define gameplay identity as the canonical package/configuration/dependency digests plus the module API/schema versions and an executable rule-artifact digest. Generate or verify the latter from the relevant executable module and its transitive rule dependencies; a hand-edited version string alone is insufficient. Cosmetic-only changes may be separated, but rules must never change silently under an existing identity.

Ensure browser, host and headless tools resolve the same module build. Include identity in network agreement, saves, checkpoints and replays. Test changing rule source without changing its declared version: old matches must not silently run with the new rules.

This milestone may introduce a new package/save schema. Migrate the two checked-in examples and fixtures. Automatic migration of schema-1 runtime saves is not required: reject unsupported old saves with an actionable message, preserve their files and keep an existing live match intact. Document the old revision needed to reopen them. Do not delete or silently rewrite .runtime state.

Continue all archive size/path/dependency/capability validation and fail-before-replacement behaviour. Package/module names and presentation strings must remain safe to display.

## 9. Preserve the existing examples

Extract Swarm Basic Prototype rules into a clearly identified module, for example games/swarm-basic/. Keep its visible name and bounded prototype objective.

Retain all existing rule regressions: Worker/Queen/Bumblebee movement, occupied-Flower transit, staging, pollen/cargo, territorial pot support, production ownership, compulsory departure, shortage/Pollen Runs ordering, capacity loss/drop placement, separate hive AP/clocks, action undo and delayed victory.

Garden Cycle remains a separately selectable package. Its flood operation, eligibility, timing and expiry belong to the Swarm module or an explicitly composed trusted extension; no default flood operation in generic engine initialization.

Existing tests may move or adapt to the new API. Preserve their behavioural expectations; do not replace meaningful scenarios with weaker assertions simply to make the refactor pass.

## 10. Independent game: Outpost Capture

Build a deliberately small, fully specified second game:

- Two participants, A and B, one activation each per round; passive system participant permitted.
- A radius-two axial hex board: 19 tiles where max(abs(q), abs(r), abs(q+r)) <= 2. Stable opaque tile IDs and reciprocal normal hex edges.
- Bases at (-2, 0) and (2, 0). Initially one Scout per player at (-1, 0) and (1, 0). Bases start empty.
- Scouts belong directly to a participant, have no pollen, cargo, support or Queen role, and cannot share tiles.
- Each participant starts with 3 fuel, maximum 6. At the beginning of each activation, add 2 fuel up to the cap and grant 3 action points, including the first activation.
- Move: one adjacent unoccupied connected tile, costing 1 AP and 1 fuel. No jumps, collection, compulsory departure or chained movement.
- Deploy: create a Scout on the player's own empty base, costing 2 AP and 3 fuel. At most 3 Scouts per player.
- Claim: a Scout standing on the opposing base may spend 1 AP to claim it and win. Entering the base alone does not win. Claim costs no fuel.
- End activation is always available when there is no pending resolution. Unused AP is discarded; fuel persists.
- After both players have completed round 30 without a claim, declare a draw. A valid claim in the final activation takes precedence over the round-limit draw.
- No combat, elimination, private information, diplomacy or additional objectives.
- Flat original space symbols and colours; clear Fuel, AP, round and objective displays.

All rules, setup, help and bot policy belong to this game's module/package. Do not implement these as renamed Swarm products/resources with invisible Queens or unused mandatory hive data.

Supply deterministic scripted winning and drawing fixtures plus a bounded bot-completion seed. Test blocked movement, insufficient resources, fuel cap, deployment occupancy/count limits, invalid claim, terminal lockout, Undo and save/replay. Use independent literal expected states/costs, not expectations calculated by calling the same helpers being tested.

## 11. Authoring and tool workflow

Provide a source-module starter and tested instructions for someone cloning the repo:

1. Install dependencies and run the examples.
2. Choose a data variant or a new coded module.
3. Create the appropriate starter, including rule/config/state validation.
4. Define resources, actions, choices, turn policy and outcomes.
5. Register the trusted module at the composition boundary and build.
6. Validate, simulate, preview and distribute the data package with its module requirements.
7. Explain which source/build must accompany a novel module for another machine to run it.

CLI/MCP capability discovery must distinguish installed data-editable behaviours from source development. Keep current scoped tools working; add template selection where needed. Do not add unrestricted shell execution or unreviewed executable source installation to MCP.

Through actual CLI and stdio MCP, create an Outpost data variant changing fuel allowances and/or the turn limit, validate, simulate, pack, import and preview it. Both routes must use shared services and produce consistent validated results. Report what an agent can do through these tools versus what requires source edits.

## 12. Acceptance gates

Maintain docs/Game_Rule_Separation_Build_Report.md with requirement → implementation → test/evidence mapping. All gates are mandatory once execution is authorized.

### A. Boundary proof

- Generic engine, host, client and modkit do not import Swarm or Outpost implementations or contain game-specific rule branches; only documented application composition/catalogue entry points select/register modules.
- Generic state/types impose no pollen, Queen, Honey, Flower, production, support or flood semantics. Do not evade this by hiding mandatory fields behind generic names.
- Build and play Outpost with the Swarm module unregistered/unavailable.
- After the interface is established, add a tiny independent test module using a novel action, resource, decision kind and outcome condition. Only its files, tests and allowed registration/catalogue entries change. Record the diff proving no engine/host/client edits.
- This test module demonstrates a cross-participant choice with save/restore and completion; it is a small fixture, not a third polished game.
- Static dependency checks complement actual runtime tests; text searches alone are not proof.

### B. Engine and preserved behaviour

Run the full existing regression suite with justified API adaptations. Prove deterministic state/event replay across process restart for both rule families; query purity; invalid-action/error/budget rollback; pending choices; transaction Undo; outcome ordering; and independent activation models.

Verify module configuration, state and continuation validation reject malformed inputs. Unknown action/decision/module IDs and forged choices cannot alter authority.

### C. Identity, recovery and networking

Exercise both games through two independent browser contexts with authenticated seats. Retain stale/duplicate/forged-command rejection, pending opposing-choice reconnect and host restart recovery. Test rule-digest mismatch and unavailable modules before match mutation.

Retain synthetic privacy checks on actual HTTP state/options/events/errors. A module's private fields must not leak through the generic projection, controller or diagnostics. No new fog-of-war claim is required.

### D. Playability and presentation

Complete both games locally using browser controls, including an Outpost win; test Outpost move/deploy/claim and draw in appropriate browser/domain layers. Verify desktop and 390x844 viewport controls. Exercise Swarm staging/production/departure/Undo after the refactor.

Verify package switching between game families resets controls/help/counters, preserves live-game return and does not leak previous rules or handlers. Retain sound/mute/load-replay checks. Inspect screenshots, not just DOM counts.

### E. Authoring and distribution

Run documented source-starter workflow, CLI workflow and actual MCP transport workflow. Data-only variants import in a matching build. A custom-module archive fails clearly in a build without that module. A clean checkout builds/runs/tests without access to the original Swarm checkout.

### F. Verification and performance

Run npm ci, npm test, npm run build, the full browser suite and npm run benchmark. Add meaningful tests for new boundaries and rules, not mirrored implementation tests.

Repeat existing two-/six-hive benchmarks and add Outpost. Preserve ordinary command/legal-query p95 under 20 ms on the documented development machine; investigate regressions rather than weakening fixtures. Record replay/restore, seeded bot throughput, network acknowledgement and browser frame measurements. Repeat ten cross-game load/play/menu cycles and inspect resource retention. Report hardware, versions, seeds, repetitions and actual results; phone viewport is not physical-device performance.

No gate is passed by prose, mocked transport alone or a data-only reskin. Failed checks remain visible with fixes and reruns.

## 13. Execution order and delivery

1. Establish current test baseline and extraction map; record public contracts and compatibility choices.
2. Create the small generic runtime/module seam and synthetic cross-player decision fixture.
3. Extract Swarm/Garden rules and controller; restore all preserved behaviour.
4. Adapt generic setup, presentation, tools and identity handling.
5. Freeze the demonstrated module contract, implement Outpost, and record any genuine interface gaps. Resolve gaps generically, then rerun the independent extension proof.
6. Complete source/data authoring workflows and compatibility diagnostics.
7. Run every gate, inspect UI, fix failures and produce the build report.

Update README, Architecture, Package_Format, Modding_Guide, Decisions and relevant reference/provenance documents. Publish the module API and a short “build your own game” walkthrough. Keep the initial build report as historical evidence; add a link explaining the limitation this milestone addresses.

After implementation authorization, make meaningful verified commits and push to the tracked engine repository. Do not force-push, modify the original game, or commit dependencies, builds, secrets or runtime saves.

Completion means a developer can create a different game's rules in a trusted game module and package, rebuild through explicit registration, and use the unchanged common engine/client/host. It does not mean arbitrary new rules can be typed into a data file or downloaded safely as executable mods.

## 14. Suggested execution instruction

“Read AGENTS.md and docs/Game_Rule_Separation_Implementation_Brief.md. Execute this brief through every acceptance gate. Preserve Swarm Basic Prototype and Garden Cycle, move their rules out of the generic engine, and prove the module interface with Outpost Capture and the independent extension fixture. Use the original Swarm repository read-only. Record actual verification, commit and push verified work, and distinguish completion from designer acceptance.”
