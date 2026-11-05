# Swarm Game Engine

A local-first, moddable hex-board engine with flat Pixi graphics, human/bot controllers, recoverable decisions, and an optional Node authority.

## Run

Requires Node 22.12+ (verified with Node 24.20.0), npm, and Microsoft Edge for browser tests.

```sh
npm ci
npm run build
npm run host:start
```

Open http://127.0.0.1:5174. For development, run `npm run dev` in a second terminal and open http://127.0.0.1:5173. The production browser includes both examples and can play locally without API access once served. Network play requires the authority.

Choose **Swarm Basic Prototype** or **Garden Cycle**, configure two to six players and assign hives, then Play locally. Each player needs at least one hive. A player can own multiple separately scheduled hives. Human/bot is selectable per player.

Select a bee by tapping or the Select bee control. Choose highlighted destinations or a Movement route. Near Bumblebee taps stage a preview: Finish move or take the second segment; AP is charged once on completion. Queen visits pause for the Queen owner's production choice, then the visitor's free departure. Keyboard controls provide the same actions. Drag to pan, scroll to zoom; Focus hive and Recenter fit the board.

The prototype objective is to spend three pollen producing Workers/Honey at your Queens, with victory after the compulsory departure. Help lists omitted full-game rules. This is an engine demonstration, not a replacement for full Swarm.

Save exports a new-engine JSON file, including a pending choice. Load from Mods while the matching package is selected. Undo reverses one complete local action; network/hidden-information undo is disabled. Saves contain no seat credentials.

Sound enables/mutes short synthesized cues after a browser gesture. Volume is remembered. All route guidance is static and works with reduced motion. No 3D or external audio service is needed.

## Network play

Create network match and share one connection JSON per player. Join with that JSON on another browser context/device. Retain it privately: it is a seat credential. Reconnect last seat restores the saved connection. Disconnected seats wait; there is no automatic takeover. The authority persists under `.runtime/host`; keep that directory to resume after restart. Invalid development checkpoints are preserved separately.

Default binding is localhost. For a trusted LAN, set `HOST=0.0.0.0` before starting the host and open its LAN address. The matching package and its digest are required on joining clients. Public hosting, accounts and matchmaking are outside this prototype.

## Mod tools

```sh
npm run mod -- list
npm run mod -- create my-variant
npm run mod -- validate .runtime/mods/my-variant/package.json
npm run mod -- simulate .runtime/mods/my-variant/package.json 500
npm run mod -- pack .runtime/mods/my-variant/package.json .runtime/my-variant.hexmod
npm run mod -- preview .runtime/mods/my-variant/package.json
```

Import the resulting archive in Mods. The preview command can start a hidden local authority; its process ID is recorded in `.runtime/preview-process.json`. Stop that process when finished. Imported host packages live in host data; browser-local imports live in browser storage. Source packages remain unchanged.

For an agent, run `npm run mcp` as a local stdio MCP companion with the repository as its working directory. See [Modding guide](docs/Modding_Guide.md). CLI and MCP call shared services.

## Verify

```sh
npm test
npm run build
npm run test:e2e
npm run benchmark
```

See [build report](docs/Initial_Engine_Build_Report.md), [architecture](docs/Architecture.md), [package format](docs/Package_Format.md), [reference mapping](docs/Reference_Mapping.md) and [asset provenance](docs/Asset_Provenance.md). Original project access is not needed to install/build/run/test.

## Planned rule separation

The current runtime still contains Swarm-specific rules. The [Game-rule separation implementation brief](docs/Game_Rule_Separation_Implementation_Brief.md) defines the next step: move those rules into trusted game modules and prove the interface with Outpost Capture, a different game with fuel, deployment and base capture. The brief is ready for review; implementation has not yet been authorized.
