# Architecture

The pure TypeScript simulation is in packages/engine. It imports no browser, filesystem, network, time or ambient random APIs. GamePackage is immutable configuration; Match owns serializable authority state. Entities have distinct type, origin area, physical location and optional carrier. Area owners determine participant control. Controller selection belongs to clients/adapters.

An activation schedules an area, not simply a player. Core slots, independent clocks and AP permit several hives owned by one participant. Decisions explicitly identify their deciding participant, independent of the active area.

Flow: authenticated seat → revision-checked command → exact legal-action validation → copied authoritative state → deterministic consequences → pending decision or completed transaction → projected view/events. Invalid commands leave input state untouched. Full transactions keep a pre-action snapshot; production, cargo and departure join the originating move. A completed action becomes one undo entry. Network undo and private-package undo are rejected by the engine.

Pollen Runs is offered before capacity losses on a shortage when eligible initial carriers exist; finishing it triggers capacity checks. Capacity decisions remove support-counted individuals until legal. Pots follow physical territory, even when carried by another area's bee. Each activation refills eligible Flower campers.

IDs use a serialized monotonic allocator. Gameplay random choices use serialized xorshift state. Stable serialization sorts object keys. Package digests use SHA-256; the lightweight state hash is a replay diagnostic, not an authentication mechanism. Replay starts from package/seed/owners and reapplies accepted actor+command pairs. Restore compares the complete reconstructed state before accepting a save.

Semantic events carry sequence, revision, transaction and optional audience. Projections omit history, RNG, allocator and other participants' privateData; decision options are only supplied to their owner. The Node host binds credentials to participants and filters views before serialization.

The initial private-information capability is participant-private package data and private decision options/events. Arbitrary hidden board entities and fog-of-war rules are not implemented. They require a later observation extension; the generic client never needs full internal match state for network play.

Host transport is JSON HTTP with revisioned polling, not lockstep or WebSocket synchronization. The host serializes command handling, caches request IDs and persists matches plus seat credentials separately from player saves. Reconnect authenticates the same seat and returns its current decision. Package import is declarative and uses the same validator as CLI/MCP/browser.

Local browser mode calls the same engine and offers hotseat/bot controls. Its trusted local runtime naturally contains the full local simulation; network clients receive filtered views. Local play is not a secrecy boundary against the operator of the device.

Flat renderer/input/HUD are in packages/client. Pixi draws projected tiles and package-defined symbols; HTML provides accessible choices. Camera/audio/preferences remain outside match state. There is one root bot timer; each board destroys its Pixi app/listeners on exit. Static route guidance honors reduced motion by construction.

The shared modkit handles filesystem adapters, SHA-256, packages, deterministic bots and workspace confinement. CLI and stdio MCP are thin wrappers. Preview launches a separate local host when necessary. The supported scheduled-operation registration API is source-only; archives cannot register executable code.
