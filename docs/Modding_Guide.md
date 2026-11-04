# AI-assisted mod creation

Install with npm ci and run npm run build. Use a coding agent in the checkout, or connect a stdio MCP client to the local companion.

Example client configuration (replace the path with your checkout; the client must set cwd):
```json
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
```

Tools: capabilities, list_packages, create_mod, read_mod, write_mod, validate_mod, simulate_mod, pack_mod, preview_mod. The server supports initialize, ping, tools/list and tools/call over newline-delimited JSON-RPC stdio. Standard output is reserved for protocol messages.

A tested workflow:
1. create_mod with name my-garden and template garden-cycle.
2. read_mod; change rules.floodEvery from 3 to 2 and presentation.floodColor to a valid hex colour.
3. write_mod with the complete edited package. This validates before writing.
4. validate_mod; resolve structured/path-bearing messages.
5. simulate_mod with limit 500; inspect decisions and winner. Repetition limits prevent endless tests from running forever.
6. pack_mod writes a .hexmod and returns its path/base64 representation.
7. preview_mod installs the package in a local preview authority and returns a URL selecting its exact digest. It can start that host if dist exists.
8. Open the URL, select controllers and Play. Or import the archive into browser-local Mods.

Equivalent commands are in README. Tool editing stays under the configured development workspace, rejects traversal and refuses create-overwrite. There are no shell tools or general filesystem reads.

Simulation bot policy: pursue Flower when empty, controlled Queen when loaded; prefer legal Honey production, otherwise make a legal choice or end the activation. Seeded gameplay results are reproducible. This is a simple demonstration controller, not a strong general strategy.

External agents can use the authority protocol: create a match, take a seat credential, call POST /api/view with id and Authorization: Bearer TOKEN, read actions, and POST /api/command with id, unique requestId, expected revision and selected command. Decisions are supplied only to the deciding seat. No paid model account or network AI service is required.

An ordinary data mod can change board/setup, supported types, budgets, production goals and scheduled-effect timing/targets. A new operation beyond that set requires a trusted developer extension and rebuild. Imported packages cannot contain scripts or arbitrary HTML. Keep rules and help honest about what the engine supports.
