# Build your own game

Clone this repository, install with npm ci, then run npm run build. The original Swarm checkout is not needed.

Change a data package when the installed module already supports your rules. Write a trusted source module when you need different actions, resources, decisions or goals. A data-only archive cannot invent or install executable rules.

## Data variant: Outpost with more fuel

~~~sh
npm run mod -- list
npm run mod -- create my-outpost outpost-capture
~~~

Edit .runtime/mods/my-outpost/package.json: change rules.income to 3. You can also edit supported allowances, turn limit, setup, board connections and presentation. Keep help text consistent.

~~~sh
npm run mod -- validate .runtime/mods/my-outpost/package.json
npm run mod -- simulate .runtime/mods/my-outpost/package.json 100
npm run mod -- pack .runtime/mods/my-outpost/package.json .runtime/my-outpost.hexmod
npm run mod -- preview .runtime/mods/my-outpost/package.json
~~~

Preview starts a hidden local authority if necessary and returns a URL selecting the package. Import the archive in Mods on another matching build. Preview process information is in .runtime/preview-process.json. A module mismatch means the recipient needs the exact trusted build; do not change the digest to bypass it.

Garden Cycle variants can still change rules.floodEvery and the overlay colour. Supported fields differ between modules.

## New source module

Use templates/signal-relay/module.ts and game.json as a small working starter. The definition is named game.json beside TypeScript so Node does not mistake it for an npm package manifest.

1. Copy the source to games/my-game/module.ts. Its two-level relative imports remain valid. Copy game.json to mods/my-game/package.json.
2. Change package ID/name/help and module ID to my-game. Define your configuration, state and rule hooks. See [Module API](Module_API.md).
3. Add a source-manifest entry in packages/composition/module-sources.json: "my-game": {"entry": "games/my-game/module.ts", "version": "1.0.0"}.
4. Run npm run identities. It stamps checked-in packages from trusted source.
5. At packages/composition/index.ts, import your factory and generated identities; register createRelayModule(identities["my-game"]) on the runtime. Rename the factory as appropriate.
6. Add your data-package import to packages/client/local-catalog.ts for offline browser selection. Node catalogue discovery already reads mods/.
7. Add focused tests using an isolated Runtime; run npm test and npm run build. Exercise generic controls, pending save, replay and host.
8. Validate/simulate/pack/preview the package. Share the trusted source or rebuilt application **as well as** its data archive.

Only explicit registration/catalogue/source-manifest entries accompany new module code. Engine, generic client, host and modkit do not need game-specific branches.

Trusted source executes with application permissions. Keep it pure, deterministic and finite. Downloaded archives contain no scripts; installing source is a deliberate developer build step.

## Local MCP companion

Build first and generate current identities. Configure the MCP client to launch Node directly with checkout cwd; npm script banners are not the protocol.

~~~json
{
  "mcpServers": {
    "swarm": {
      "command": "node",
      "args": ["--import", "tsx", "packages/mcp/main.ts"],
      "cwd": "C:/path/to/swarm-game-engine",
      "env": {"SWARM_MOD_WORKSPACE": ".runtime/mods"}
    }
  }
}
~~~

Tools: capabilities, list_packages, create_mod, read_mod, write_mod, validate_mod, simulate_mod, pack_mod and preview_mod. Transport is newline-delimited JSON-RPC stdio. stdout is reserved for protocol messages.

For Outpost: create_mod with template outpost-capture; read_mod; change rules.income; write_mod; validate_mod; simulate_mod; pack_mod; preview_mod. Tests use the real process and equivalent CLI services.

Tools edit data packages only under the configured workspace. They do not install executable modules, edit arbitrary source files or provide a shell. A coding agent with repository access can perform the trusted-source workflow separately.

## Compatibility and external controllers

Packages/saves use schema 2 with exact module/source identities. Schema-1 saves are not migrated: retain them and reopen using commit 2c6d11c. Source changes require identity generation, rebuild and process restart; running matches are never silently upgraded. Development hot replacement is disabled and stale source is rejected.

External agents use authenticated /api/view and /api/command with current revision, unique request ID and a supplied legal command. The authority checks rules. Tokens are seat credentials and never exported in game saves.
