# Architecture

The pure runtime in packages/engine processes validated commands, checkpoints complete actions, manages deterministic RNG/IDs, filters events and decisions, and validates save replay. It imports no games or platform APIs. Match metadata wraps opaque module-validated core state.

The [module contract](Module_API.md) puts configuration, setup constraints, actions, decisions, phases, resources, observations, outcomes and optional bot policy in trusted modules. Swarm Basic Prototype/Garden Cycle use games/swarm-basic; Outpost Capture uses games/outpost-capture. Neither family is mandatory for a Runtime instance.

packages/composition/index.ts registers modules; module-sources.json declares trusted source entries. packages/client/local-catalog.ts lists offline data packages. These are allowed integration edits for a new game; common host/client/modkit code does not branch on game IDs.

Flow: authenticated seat → revision/exact legality checks → isolated draft → rule consequences → validated state/signals → pending cross-player decision or settled action/outcome. Undo restores completed action state, RNG and allocator. Network/private-package Undo is forbidden; modules can forbid reversal.

Queries isolate current state without copying full history. Pixi/HTML receives declarative board/entity/status/action descriptors. It handles buttons, routes, staged previews, camera, accessible selectors and synth cues without knowing pollen or fuel. Bots receive permitted observations and public definitions.

The Node authority uses JSON HTTP, revisioned polling, random seat credentials, idempotent requests and persisted checkpoints. Unavailable package/checkpoint records are retained when new matches are persisted. Reconnect resumes the same seat and choice. Public hosting/accounts remain out of scope.

CLI/MCP wrap shared modkit operations. ZIP data invokes installed modules; archives never register or execute scripts. Novel trusted source needs explicit registration and rebuild. Digests cover transitive local TypeScript and common runtime. Direct Node startup verifies generated identity. Vite disables HMR and rejects stale source.

Save schema 2 pins package/module identity. Restore replays inputs and compares canonical full state, including pending continuations. Schema-1 files get an actionable rejection and remain preserved. Replay cost grows with history.

Local play needs no API/cloud after serving the build. Local hotseat is not a secrecy boundary against the device operator. Network clients receive filtered observations. Existing private-data/decision/event checks remain; arbitrary hidden-board mechanics are deferred.

Trusted callbacks must terminate and remain pure. The 256-event budget catches excessive emission but cannot interrupt infinite synchronous code; the extension API is not an untrusted-code sandbox.
