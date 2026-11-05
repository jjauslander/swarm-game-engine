# Trusted game-module API

The executable contract is packages/engine/types.ts. Runtime in packages/engine/index.ts contains no game implementation. packages/composition/index.ts explicitly registers trusted modules. Every Runtime has a separate registry; duplicate IDs and incompatible API/build identities fail.

## Module lifecycle

| Hook | Responsibility |
|---|---|
| identity, stateSchema, setup | Exact source build identity; internal state version; bounded player/area setup controls |
| validatePackage(value) | Return actionable errors for the game's configuration and references |
| initialize(package, draft, owners) | Set draft.core to validated game state; perform initial turn effects |
| validateState(package, core) | Reject malformed state and serialized continuation data |
| actions(package, isolatedMatch, participant) | Return exact currently legal command payloads, without mutation or RNG consumption |
| apply(package, draft, command) | Resolve one validated command and its finite consequences |
| signals(package, isolatedMatch) | Return active participant, pending decision or proposed outcome |
| observe(package, isolatedMatch, viewer) | Return permitted board, counters, controls and status |
| policy(package, observation) | Optional deterministic finite bot policy; receives no authority state or private package map |
| undoAllowed(package, settledMatch, command) | Optional completed-transaction undo policy |

A module's interfaces extend GamePackage and define its Core. The core runtime carries this state opaquely; no pollen, fuel, support or production fields are required. Common package metadata and topology are validated centrally. Module validators own additional configuration. Keep rule dependencies as explicit relative TypeScript imports so source identity can follow them.

The runtime creates match identity, controllers, RNG/ID counters, revision, pending checkpoint, history and event/input records. Initialize/apply hooks mutate draft.core and use emit, id and random from packages/engine/services.ts. These are trusted source hooks, not an arbitrary-code sandbox. Do not alter authority metadata, access platform APIs, use Date/Math.random, or run unbounded loops.

## Decisions and transactions

A Decision has id, owner, arbitrary game-defined kind, and options with IDs, labels and exact commands. Optional target connects a choice to a board tap. Store continuation state as validated plain data in the game's core. A choice can belong to someone other than the active player.

The runtime checks actor/revision and exact legal command equality before invoking apply on an isolated draft. Invalid commands and failed hooks leave source state, RNG, IDs and events unchanged. The first submitted step captures a checkpoint. While signals returns a decision, the transaction stays open and no outcome is finalized. Settlement makes one undo entry for the whole action. Network/private-package Undo is forbidden; a game can forbid further Undo via its policy. Outcomes carry a winners array (empty for a draw) and structured reason.

Event emission is capped at 256 events per submitted revision. A non-returning synchronous trusted callback cannot be interrupted by this mechanism. Source callback exceptions are not sent to clients with private details.

## Observations and controls

Observation contains visible tiles/entities, tile colours, focus tile IDs, status text, labels, legal commands and controls. Entities have symbol, owner, location and optional badge/hidden fields. Controls are button or route; each carries the exact command. A route supplies actor and path. staged permits a first-segment preview; previewBadge supplies projected display without client gameplay calculations. A primary button occupies the common main action control.

The client does not interpret game state or infer movement legality. Text is displayed as text, never package HTML. Descriptors are validated; the runtime supplies revision, outcome, permitted decisions/events and Undo availability. The module projects only the viewer's permitted game fields. Network clients never receive authoritative RNG/history. Hidden board entities/fog of war remain outside this milestone.

Queries use isolated current-state copies with history omitted. Bot policies receive the viewer's projection and public definition, with the package private-data map removed; invalid suggestions fall back to the first legal action. Policies must be bounded and deterministic. No model account is required.

## Working examples

- games/swarm-basic: per-hive activations, pollen/support, compound Queen visits, delayed production victory and Garden flooding. Source-operation registries are instance-scoped.
- games/outpost-capture: participant turns, fuel, deployment, explicit claim victory and round-limit draw.
- templates/signal-relay: source starter with charge, transmit/recharge actions and an opposing accept/reflect decision. Its tests establish that no common implementation edits were needed.
