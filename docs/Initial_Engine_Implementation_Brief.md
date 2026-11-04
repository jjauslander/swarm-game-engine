# Initial moddable game engine — implementation brief

Revision 1 · 5 November 2026 · Prepared for execution with Sol 6.1

## 1. Status, objective and authority

This is a planning deliverable requested by the designer. Writing or committing this brief does not start implementation. Begin the build when the designer instructs you to execute this brief. Once instructed, carry it through the acceptance checks below without repeatedly asking about routine implementation choices.

Target repository: https://github.com/jjauslander/swarm-game-engine
Reference repository: https://github.com/jjauslander/swarm-board-game

Build a small, stable, deterministic hex-board game runtime that loads versioned game packages. Deliver a playable Swarm example, an independent variant that demonstrates real extensibility, local and two-client network play, and shared mod-development tools accessible through commands and MCP.

The designer explicitly selected the earlier flat Pixi/HTML appearance and basic sounds for the initial example. Do not begin with the Blender/Babylon assets or a 3D presentation.

The current Swarm game is a reference and source of reusable material. This project is a new engine. Its first example is a deliberately bounded prototype, not a claim to have ported or replaced the full accepted game. Full Swarm parity, final visual approval and physical-device acceptance remain separate.

Latest designer instructions override this brief. Record substantive changes in a decision log. Resolve routine architecture, naming and dependency choices independently. Ask only if a necessary decision changes the product scope or an unresolved reference-rule conflict affects an included behaviour.

## 2. Repository boundaries and reference access

Work in the new repository. Inspect its current README, LICENSE, instructions and Git status before editing; preserve unrelated work. At brief preparation the default branch was main, README described the engine, LICENSE contained Apache 2.0, and no AGENTS.md or implementation existed at the checked paths.

The reference checkout available during review was:
C:/Users/jjaus/OneDrive/Documents/ChatGPT/Swarm-boardgame
Its inspected HEAD was 6c57ddac2b2deaf4fc62df2b6a7a0ce1705d712a.

You may read the original repository, inspect Git history, run focused reference tests, and reuse suitable code, algorithms, fixtures and permitted assets. Keep it unchanged. If that path is unavailable, clone the reference into a separate sibling/reference directory outside the engine source tree. Record the exact reference commit used. Never reset a user's checkout to obtain a historical asset: use git show or a separate checkout.

The new project must build, test and run independently. No production imports, runtime reads, absolute paths or build requirements may refer to the original checkout. Reference access is for development and provenance only.

Read the original AGENTS.md and README, then relevant briefs and build reports. Existing code explains behaviour but is not authority over explicit designer rulings. Relevant sources include:
- Swarm_Milestone_2_Implementation_Brief.md and docs/Milestone_2_Build_Report.md.
- M3 brief and build report, especially later playtest supersessions.
- Swarm_Milestone_4_Implementation_Brief.md revision 40 and its build report.
- Swarm_Multiplayer_Implementation_Brief.md and opening/setup supersessions.
- Swarm_Bot_Development_Roadmap.md before examining/adapting bot strategy.
- Swarm_Board_Presentation_And_Sound_Brief.md and corresponding build report.
- Swarm_Deferred_Work_Register.md for context; old-project deferrals do not cancel network play explicitly scoped by this new brief.

Useful code entry points:
- src/domain/types.ts, geometry.ts, state.ts, movement.ts, economy.ts, confrontation.ts, lifecycle.ts.
- src/application/session.ts, confrontation.ts, lifecycle.ts, persistence.ts, bot-match.ts, bot.ts, bot-competent.ts.
- src/presentation/board.ts, board-port.ts, assets.ts, materials.ts, route-trail.ts, sound-effects.ts.
- tests/geometry.test.ts, rules.test.ts, bumblebee.test.ts, routes.test.ts, economy.test.ts, multiplayer.test.ts, combat.test.ts and relevant browser tests.

Do not transplant Session or GameState wholesale. They contain game-specific choices, history and presentation concerns which the new contracts must separate.

## 3. Fixed scope and exclusions

Required:
1. Headless engine with serializable state, deterministic execution, decisions, effects, outcomes and events.
2. Hex topology and area ownership, distinct player/controller identities and a passive-by-default system participant.
3. Versioned package validation, packing, importing, selection and dependency/version checking.
4. One playable flat Swarm Basic Prototype package.
5. A second package with an active system participant and temporary rule modification, requiring no engine-code edits.
6. Local hotseat, local bot and fully automated games.
7. An authoritative Node host and two separate browser clients, including reconnection during a pending choice.
8. Save/load and replay, including pending authoritative decisions.
9. Shared CLI/modkit and a working local MCP development route.
10. Automated correctness, browser, network and performance verification with an honest build report.

Deferred:
- Complete M4/modern Swarm port, advanced bot tiers and universal strong AI.
- Rich 3D, Blender assets, full dual-renderer implementation, multilevel gameplay, live moving/rotating board areas.
- Arbitrary combinations of competing rule mods, marketplace, payments, public matchmaking, accounts, cloud deployment.
- Arbitrary downloaded JavaScript execution, a universal programming language for rules, hosted LLM inference.
- Native installer, mobile app packaging and the previous large single-file HTML distribution.
- Compatibility with existing Swarm saves. New engine saves start with a new schema.

The schema should leave room for future topology and presentation extensions. Implement and prove current requirements; avoid speculative subsystems.

## 4. Initial structure and dependency direction

Use TypeScript, a browser client with Pixi and HTML/CSS controls, a Node authority, and a lightweight workspace layout. Retain proven test tooling where practical. Pin dependencies with a lockfile and record runtime requirements. Verify current APIs against installed dependencies/official documentation when implementing.

Suggested layout (equivalent arrangements are acceptable):
- packages/engine: pure simulation contracts and execution.
- packages/modkit: schemas, validation, templates, simulation and packaging services.
- packages/protocol: transport messages and projected client views.
- packages/host: authoritative matches, seats, persistence and network transport.
- packages/client: Pixi adapter, input, basic HUD, menus and audio.
- packages/cli: command wrappers over modkit/host.
- packages/mcp: MCP wrappers over the same services.
- mods/swarm-basic-prototype and mods/garden-cycle.
- tests/fixtures, tests/integration, tests/e2e.
- docs: contracts, decisions, reference mapping, modding guide and build report.

Engine code must not import DOM, Pixi, audio, filesystem, networking, wall-clock time or ambient randomness. Mods must not import client internals. Neither core engine nor generic client should switch on a package ID to implement its rules. Platform adapters provide storage, scheduling and transport.

## 5. Authoritative state and execution contracts

Define these concepts explicitly:
- Participant: persistent identity; human seat or system participant.
- Controller: human, local bot or external agent attached to a seat; separate from ownership.
- Area: identity, type, tile membership and owner.
- Tile: stable opaque identity, local hex coordinate and logical edges.
- Entity: identity, type, location and schema-validated package data.
- Activation: scheduled slot for a participant, area or group, with its own phase and resource budgets.
- Decision: unique identity/revision, deciding participant, permitted options, prompt and continuation.
- Action transaction: initiating command, accumulated consequences and pending decisions, commit/cancel/undo policy.
- Effect: source, target, explicit ordering, duration and expiry trigger.
- Outcome: nonterminal, winner(s), draw or package-defined completion, with structured reason.

Do not collapse owner, controller, origin area, current territory and active area into one field. Swarm's carried-pot support and per-hive AP are concrete reasons.

All mutation enters through validated commands. Proposed shape:
submit(authorityState, authenticatedActor, commandEnvelope)
  -> accepted(nextState, projectedEvents, pendingDecision or committedAction)
  | rejected(structuredError)

Command envelopes include match ID, unique request ID and expected authority revision. Bind actor identity from the authenticated seat/session, not a client-supplied player ID. Validate decision ID and revision, payload schema, legality and ownership before applying. Rejected commands must not spend AP, consume random values or partially change state.

Automatic effects run until either a decision is needed, the action is complete or a bounded execution limit fails. No recursive unbounded triggers. Define stable ordering and error diagnostics. Roll back the submitted step on a failed effect chain; never leave partially mutated authoritative state.

Decisions are plain serializable data, not closures or suspended JavaScript stacks. Every accepted decision response advances the authority revision, even when the board has not visibly changed.

A complete action can cross multiple participants' decisions. Settle compulsory consequences before outcome evaluation and final action history commit. UI animation completion never authorizes or delays gameplay resolution.

Local preview state is separate from authoritative state. A staged movement must make its reserved/projected effects explicit; it cannot secretly spend AP twice or count as a finished action.

## 6. Topology, identity and ownership

Retain hex tiles for this iteration. Provide axial-coordinate helpers, directional neighbours, distance and jump/path queries as reusable utilities.

Tile IDs must survive future changes in placement. Store logical connections independently of rendered position. Edges need direction/type information so straight jumps are meaningful. Distinguish graph distance from geometric hex distance and document which each rule uses.

Swarm's 259-cell board and exact hive/garden arrangement are package data, not a global engine BOARD. The package specifies participating areas; unused starting hives are neither playable nor rendered/hittable. A generic small board must also work.

Initial runtime topology may be fixed for the match. Future dynamic-layout support should not require replacing tile identity. Add validation for duplicate identities, missing destinations, invalid area membership and inconsistent declared reciprocal connections.

The system participant can own shared areas and receive scheduled/event-driven actions. It is passive unless the package enables behaviour and has no automatic victory condition. System privileges are explicitly defined; clients cannot impersonate it.

## 7. Determinism, events, simulation and history

Persist seeded gameplay RNG state and a deterministic entity/effect ID allocator. Keep cosmetic randomness outside gameplay state. Use stable ordering for simultaneous effects, options and ties. Capture external inputs as validated commands; do not call external services inside simulation.

Replay identity includes exact package/dependency digests, engine compatibility, initial setup/seed and accepted inputs. Replay produces the same normalized authoritative state/hash after every accepted step, including pending decisions. Exclude cosmetic timestamps from that hash.

Emit typed semantic events such as movement, resource change, decision requested/resolved, activation started, effect applied/expired and outcome declared. Include transaction/revision/sequence identity and enough causal information for debugging. Keep human-readable text derived from events rather than making text the replay protocol.

Filter events for each viewer just as state is filtered. Never leak hidden targets, random state, private options or internal state through logs/errors.

Live presentation consumes newly delivered events once. Replay, reconnect and save-load must not replay historical sounds accidentally. Simulation can suppress event rendering/storage overhead while preserving identical rule outcomes.

Provide cheap isolated simulation/fork operations for bots and tests. Do not copy unbounded UI logs, decoded assets or every historical checkpoint per hypothetical action. Start with a simple measured approach; optimize after profiling.

## 8. Saves, undo and recovery

Use a new, schema-validated save envelope containing engine/schema compatibility, package/dependency identities and digests, initial configuration, authoritative state, pending action/decisions, RNG/ID state and the history required by the declared policy.

Authority checkpoints must restore mid-decision. A client reconnect receives its current projected state and outstanding decision, without asking the initiator to repeat a move.

Pin running/saved matches to their package versions. Reject missing/incompatible versions with actionable messages; never silently upgrade rules. Persist packages or provide a clear reinstallation requirement.

Separate authoritative match state, private bot memory, local camera/audio preferences and development scenarios. Credentials/seat tokens are not exported in player-facing save files.

Default prototype undo policy:
- Local all-visible play supports reversal of the last completed action as a whole, including AP, cargo, production, RNG and derived effects.
- Cancelling an unfinished action is allowed only where the package declares it safe.
- Network play has undo disabled initially; explain this in UI.
- Hidden-information and irreversible actions can prohibit undo. The engine must enforce this rather than relying on a disabled button.
- Surrender, if later added, is not implicitly undoable.

Corrupt saves, oversized payloads and invalid dependency references fail before altering a live match. Preserve the current match until a replacement successfully loads.

## 9. First package: Swarm Basic Prototype

Deliver a clearly labelled “Swarm Basic Prototype”, using the real 259-cell layout and earlier flat appearance. It is intentionally a rules subset with a prototype objective. Do not present it as the full accepted game.

Required playable subset:
- Setup for two to six human/bot players, with freely allocated participating hives and at least one fixture where a player owns two separately scheduled hives.
- Six AP per hive activation; preserve source rules for included Worker, Queen and Bumblebee movement, jumps, occupied-Flower transit and compulsory free departure.
- Basic pollen collection and cargo occupancy; Honey Pots and territorial support.
- Queen visits with the Queen's controlling player choosing production or keeping pollen, followed by compulsory free departure, as one complete action.
- Restrict production choices to Worker and Honey Pot in this prototype. Preserve legality/support/placement of those products; list excluded choices in package help.
- Include the two-segment Bumblebee staging interaction; do not require Swarm units, Royal Jelly, walls or combat for this milestone.
- Starting setup is a small documented fixture with Queens, Workers, Bumblebees and enough Honey support; do not copy an opening that depends on omitted gestation rules.
- Capacity handling for included units/resources must remain valid. If a support shortage can occur in this subset, implement its mandatory loss decision rather than letting invalid state persist.
- Existing compulsory-choice ownership and independence of AP/support across same-player hives must hold.

Prototype-only objective: first player to spend three donated pollen on allowed production at their controlled Queens wins. Count each pollen actually spent by that Queen's controller; a donation from another player's bee can contribute. Check victory only after the visit and free departure settle. Display the package name as “Swarm Basic Prototype”. Describe this production-based objective in its rules/help; it is a new demonstration objective, not a supersession of Swarm victory rules. A local bot must be able to complete a match; add a repeatable completion fixture and a bounded simulation with a reported result.

Excluded Swarm systems: attacks/theft/evasion, Swarm upgrades, walls, gestation, succession, conquest, collapse, voting and full M4 victory. Document them in a capability/parity matrix. Keep source behaviour for included rules; do not invent approximations to make tests pass.

Required scenarios include a visitor delivering to an opposing Queen, a zero-AP mandatory departure, support provided by a carried pot in another territory, a staged Bumblebee move through the Flower, and one player receiving separate activations for two hives. Port the relevant reference expectations with attribution. Where the prototype objective differs, test it separately.

If a listed subset dependency makes one omission impractical, document and implement the smallest necessary supporting behaviour. Escalate a material scope expansion; do not quietly build the entire old game.

## 10. Second package: Garden Cycle

Build a separately selectable and distributable variant proving that the package interface changes gameplay without edits to engine, host or generic client code.

Reuse declared presentation assets/dependencies. Configure:
- A system activation after each completed round of scheduled hive activations.
- Every third round, the system floods one declared ordinary Garden tile selected with the seeded gameplay RNG.
- Choose only unoccupied eligible tiles; if none are eligible, emit a documented no-op event.
- Flooding prevents landing or stopping there; jumping across is permitted when the underlying movement rule permits it.
- The effect expires at the next system activation, before any newly scheduled flood is applied.
- Exclude the Flower and area connection-critical cells in the fixture so the demonstration does not accidentally deadlock normal collection.
- Display a simple overlay, effect duration and system action in the log.

The engine supplies scheduling, conditions, effects and legal-action composition. Garden tile IDs, eligibility and flood timings belong in package definitions. Add a small altered-board fixture to prove the generic runtime is not secretly tied to 259 cells.

Use a separate synthetic test package/fixture for hidden information and private decisions. Swarm is mostly open-information and cannot by itself prove privacy enforcement.

## 11. Flat presentation and basic audio

Reuse the earlier Pixi/HTML approach: readable hexes, simple bee/pot/Queen symbols, player colours, selection and destination highlights, route previews, basic movement, pan/zoom/recenter and area focus. Retain clear AP, phase, decision-owner and outcome displays.

Inspect historical source rather than assuming today's sound-effects.ts represents the requested basic sounds. Reference history includes:
- dae246f: hive badges, glowing route trails and replaceable board effects.
- 27022d0: wooden inlaid puck styling.
- 80df373: renderer-independent board contract.
- 2fa094b: production Babylon integration behind a development switch.
Use git show/log to verify these commits and select an appropriate earlier flat baseline. Their dates alone do not prove visual suitability.

Prefer the early simple/synthesized cue implementation from the presentation/sound work; avoid copying large later recordings or ambient libraries. Basic move, production, turn and outcome sounds are sufficient. No new generated assets, Blender, 3D models or rich ambience required. Document source commits and modifications in an asset provenance file.

Provide mute/volume, browser audio unlocking on user gesture, reduced-motion/static route guidance, touch support and keyboard-accessible controls. Audio failure must not prevent play. Dispose animation/audio/listeners/textures on package switch and return to menu.

The generic renderer receives projected view data and package presentation mappings. It must not receive full secret authoritative state. Game-specific symbols/themes live with the package. Basic menus/HUD are functional defaults that packages configure using supported controls; arbitrary HTML/scripts from imported packages are not executed.

Verify desktop and a phone-sized viewport: selection, route choice, production, pending response, free departure, Undo and menus. Keep decision targets visible and the deciding player explicit. The host controls validated actions; UI restrictions alone never enforce rules.

## 12. Package format and extension policy

Use a folder during development and one archive for distribution (choose and document an extension; .hexmod was illustrative, not mandatory).

Manifest fields: package ID/name/version, description, author, schema version, engine compatibility, entry definitions, dependencies with resolved version/digest, required capabilities, asset references and license/provenance metadata.

Validate all files and cross-references before activation. Detect dependency cycles/conflicts, unsupported capabilities and missing assets. Reject path traversal, absolute paths, archive symlinks and oversized/decompression-limit violations. No install hooks. Content digests and exact resolved dependencies identify gameplay packages.

Initial trust boundary:
- Ordinary imported archives contain declarative definitions/assets and invoke registered, typed operations.
- The source repository may supply explicitly trusted extension modules through a documented registration interface.
- Do not import/eval JavaScript from a downloaded archive or treat a Worker/Node vm as an adequate security sandbox.
- Both included packages and the MCP-created variant must work within the documented supported operations. If custom source code is needed, classify that as a developer extension requiring rebuild, not an ordinary installable mod.
- General untrusted executable mods are deferred.

Do not build an unlimited DSL. Implement small composable conditions/effects sufficient for the two packages, with schema validation and bounded execution. A trusted module may add an operation through a generic registration API; no engine checks for specific package IDs. Document the extension boundary candidly.

The Mods screen imports, lists, validates and selects packages; displays version/dependencies; configures participants and starts play. Failed imports preserve installed working packages. Match rules are fixed when it starts. Do not hot-reload rules into an active match.

## 13. Local/network host and controller interfaces

Run the same simulation locally and on a Node authority. Browser-local play needs no network service or cloud connection. Network play initially uses a local/LAN host; no public deployment is required.

Use a documented message protocol for setup, joining a seat, snapshots, commands, acknowledgements, errors, projected events and reconnect. Enforce exact gameplay package/dependency/configuration agreement before joining. Separate cosmetic settings from gameplay identity.

Use unguessable seat/reconnect credentials and reject unauthorized seats. Persist/recover credentials separately from exported game data. Duplicate request IDs return the previous acknowledgement without applying twice. Stale revisions are rejected with a fresh-view route. Serialize accepted commands per match.

On disconnect, preserve the pending choice and offer reconnect; no silent automatic move or controller takeover. Host explicitly manages reassignment. Graceful host restart must restore a checkpoint, including current decisions; document how a seat is reauthenticated.

All controller types request permitted observations/decisions and submit through the same command path. Supply a deterministic simple bot with bounded work, cancellation and fallback legal actions. An external-agent adapter supports observation, legal choices and command submission without requiring a paid model service. Do not give a bot authority to inspect hidden opponent state through a simulation backdoor.

Test privacy using deliberately different private values in two seats; inspect actual responses/events/errors, not just screen appearance. Prevent private saved state/RNG from entering browser payloads. Private logs are filtered.

## 14. Shared modkit, CLI and MCP

Implement shared services, then thin CLI/MCP wrappers. Minimum operations:
- Discover engine capabilities, schema versions and documentation.
- List/read installed packages and supported examples.
- Create a mod from a template under a designated development directory.
- Read/update supported definition files there.
- Validate and return structured errors with file/path and repair guidance.
- Simulate a fixture or seeded bot match with a decision/work limit.
- Inspect structured results and logs.
- Start/open a local preview with explicit package/version.
- Pack a validated directory into the standard archive.

Document exact runnable commands, for example mod:create, mod:validate, mod:simulate, mod:pack and host:start. Naming may differ but operations must be discoverable and scripted. Examples must actually run.

MCP is a local Node companion process, using a supported transport such as stdio for this milestone. A browser tab alone cannot host that local process. Provide launch/config instructions and a UI/help entry explaining the companion; do not claim a native installer exists. Keep mod editing scoped to the configured workspace, with no arbitrary shell or filesystem access tools.

Both routes must produce equivalent valid packages. Test actual MCP requests over the chosen transport, not just direct calls to the backing functions. Provide a captured example: clone template, change flood interval/overlay, validate, simulate, package, import and play without modifying engine code. No live LLM account is required for the automated workflow test.

## 15. Acceptance tests and evidence

Create a traceability matrix mapping every requirement to code and tests. Use focused tests at the right boundary, with reference fixtures for included Swarm semantics. Minimum gates:

A. Simulation:
- Identical inputs replay to identical hashes across process restart.
- Random choices/ID allocation restore correctly; rejected commands consume neither.
- Pending decisions serialize and restore; responding participant differs from active participant.
- Multiple area activations for one owner keep independent clocks/AP.
- Whole-action undo restores all included consequences.
- Effect ordering/expiry and bounded loop failure are deterministic.
- Outcome waits for required departure; no premature win.

B. Reference subset:
- Worker/Queen/Bumblebee steps and jumps, staged one/two segments, invalid route rejection.
- Flower entry/transit/departure, cargo capacity and zero-AP free departure.
- Opposing Queen production ownership and optional keep-pollen.
- Product placement/support and carried-pot territorial support.
- Actual complete playable prototype match and deterministic bot completion fixture.
- Declared omissions are visible in help and parity matrix.

C. Packages:
- Both packages run through the same runtime without package-specific engine branches.
- Garden Cycle changes behaviour through definitions/registered operations.
- Small alternate topology works.
- Invalid dependency/version/path/capability/asset cases fail safely.
- Running and saved matches keep exact package identities.

D. Networking/privacy:
- Two independent browser contexts, distinct seats, one authoritative match.
- Forged seat, duplicate input, stale response and invalid choice are rejected correctly.
- Disconnect/reconnect and authority checkpoint restore while an opponent chooses production.
- Private fixture information cannot be found in the other viewer's state, legal options, events, logs or errors.
- Match continues after reconnection and reaches an outcome.

E. Presentation:
- Desktop and phone viewport input flows.
- Flat appearance and basic cues; no Blender/Babylon runtime dependency.
- Mute/reduced motion and unavailable audio do not break play.
- Load/reconnect/Undo do not replay old sounds.
- Repeated package switches release old resources and handlers.

F. Tooling:
- Clean install, build, unit/integration/browser suites.
- CLI and real MCP transport workflows yield installable variants.
- Local play and headless simulation operate without external network access after installation.
- New checkout operates with reference checkout unavailable.

## 16. Performance verification

Measure rather than infer performance from code structure. Supply reproducible fixtures, seeds, runtime/hardware/browser versions, repetitions and machine-readable results.

Record median/p95 command resolution and legal-option query latency, bot/simulation throughput and memory, archive load time/size, pending-save restoration time, network acknowledgement latency and presentation frame intervals.

Use a normal two-player fixture and a six-hive/multiple-owner fixture. Separate headless costs from rendering and controller search. Use a fixed deterministic work limit for reproducible bot decisions; wall-time limits protect responsiveness but must not silently change authoritative rules.

Initial engineering targets on the recorded development desktop:
- Ordinary command/decision resolution and legal-option queries p95 under 20 ms on representative fixtures.
- Simple bot control remains cancellable and UI input responsive; long tasks above 50 ms are investigated.
- Flat-board active presentation targets 60 fps; report actual frame medians/p95 and stalls, not only an FPS counter.
- Ten load/play/menu/package-switch cycles show no growing active listener/audio/scene counts and no unbounded retained memory trend.

These are acceptance targets to measure, not claims already established. If one fails, profile and address the cause, then report any remaining limitation explicitly. Do not hide a failure by reducing board participation or removing required effects. Phone viewport tests are not physical-phone performance evidence. Designer/device review remains separate.

## 17. Implementation sequence and checkpoints

Stage 0 — reference and contracts:
Record source revisions, subset/parity matrix, flat/audio baseline, license provenance, schemas, decision model and dependency layout. Add a short decision log. Preserve the target LICENSE; review copied material's terms instead of assuming every asset inherits the engine license.

Stage 1 — headless vertical slice:
Create one small board, two participants plus passive system, a move that pauses for an opposing decision, deterministic continuation, save/replay and whole-action undo. Establish core tests before implementing extensive UI.

Stage 2 — package and flat playable example:
Load Swarm Basic Prototype from its package, implement included behaviours, basic HUD/input/audio, local human/bot play and a complete match. Deliver import/select/play early.

Stage 3 — authority/network:
Use the same engine through two clients; prove seat binding, privacy, stale/duplicate handling and reconnect/checkpoint restore. Address design failures now.

Stage 4 — extensibility:
Add Garden Cycle and the small-board/private-information fixtures. Changes to generic engine capabilities are allowed when genuinely general; reject package-name special cases. Then freeze the demonstrated contract for this milestone.

Stage 5 — authoring routes:
Finish shared modkit CLI and real MCP transport, docs and create/validate/simulate/preview/package workflow. Prove an agent-style variant without engine edits.

Stage 6 — verification and delivery:
Run clean build/tests/browser/network/tooling/performance checks, inspect rendered desktop/phone flows and update the build report with commands/results. Fix failures before claiming completion.

Make meaningful verified commits and push to the tracked new repository when implementation is authorized. Do not force-push or commit node_modules, generated builds, secrets, temporary checkouts or large recordings. Record failures and reruns faithfully. Do not mark a stage complete with placeholder implementations for its required behaviour.

## 18. Required handoff documents

Deliver:
- README with clean install/run/test commands, local and network play, package selection and MCP companion setup.
- docs/Architecture.md with boundaries and authoritative state/decision flow.
- docs/Package_Format.md with schema, compatibility, dependencies and trust restrictions.
- docs/Modding_Guide.md with a tested conversational/CLI/MCP example and supported extension limits.
- docs/Reference_Mapping.md with pinned source paths/commits, included rules and explicit omissions.
- docs/Asset_Provenance.md with flat graphics/basic sound sources and licensing.
- docs/Decisions.md with material implementation decisions and rationale.
- docs/Initial_Engine_Build_Report.md with requirement-to-test matrix, actual commands/results, benchmark evidence, known limitations and designer review checklist.

Completion means both packages are playable, the same engine serves humans/bots/network clients, pending decisions survive recovery, the authoring routes produce real installable variants, and all mandatory checks have recorded outcomes. A scaffold, mock UI, JSON schema alone or source-only demonstration does not satisfy this brief.

## 19. Suggested execution instruction for Sol 6.1

“Read AGENTS.md and docs/Initial_Engine_Implementation_Brief.md in swarm-game-engine. Execute the brief through its acceptance gates, using swarm-board-game as a read-only reference and source of selectively reusable code/assets. Keep the initial presentation flat Pixi/HTML with basic sounds. Record implementation decisions and actual verification, commit and push verified work, and distinguish prototype completion from full Swarm parity and designer acceptance.”
