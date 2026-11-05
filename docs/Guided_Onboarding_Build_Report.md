# Guided onboarding build report

5 November 2026.

## Request and outcome

The designer found setup too difficult and requested three facilitated routes: install/play, adapt an existing game, and create a game through a guided conversation. They clarified that they use Claude Code in a local terminal or desktop app.

CLAUDE.md now opens an unspecified conversation with those three choices. docs/Guided_Game_Workshop.md supplies the route-specific instructions. Existing specific requests proceed directly without repeating the menu. README starts with the single phrase "Help me get started." Cloning alone cannot trigger an assistant response.

Play handles installation, build, server startup and a verified link. Adapt explains the chosen game and makes a named copy. Create establishes the idea, desired degree of design help, objective, layout, turn and first experiment one question at a time as needed; complete rules or permission to invent do not trigger a redundant interview. Both creative routes require implementation of a playable slice, focused validation, preview and iteration. A per-game DESIGN.md retains decisions and provisional suggestions between sessions.

## Implementation

- Plain Node scripts/play.mjs runs before project dependencies exist. npm start installs with npm ci when needed, builds, and serves the client and API together.
- Supports foreground or background startup, automatic free local port selection, explicit port, and optional cloud binding. Progress describes installation, preparation and startup.
- Reuses the same running build. Changed source, graphics or sound files trigger a rebuild and restart. Installation/build fingerprints are disposable .runtime data.
- npm run play:stop stops only the process identified by the launcher's own record and matching health response. Other services and modkit previews are not stopped. Existing persisted match storage is not deleted.
- Added GET /api/health to identify the service, process, launch instance and build. No gameplay rule changes.
- Updated the host-only entry in docs/verification/module-boundary-baseline.json for this later lifecycle endpoint. The original rule-extension evidence remains historical; this is not a claim that the host has never changed since that proof.
- No runtime dependency, bundled game, schema or graphics replacement was added. Original Swarm stayed read-only.

## Actual verification

Windows with the existing Node/npm toolchain:

| Command | Result |
| --- | --- |
| npm run test:launcher | 3 passed |
| npm test | 49 passed |
| npm run build | TypeScript check and Vite production build passed |
| npm run test:e2e | 15 Microsoft Edge browser tests passed, desktop and phone viewports |
| git diff --check | Passed |
| git status --short in original Swarm | Empty; original checkout unchanged |

The launcher integration test creates an isolated source copy without node_modules, dist or .runtime. Its first invocation performs npm ci and a production build, then serves the actual game page, health endpoint and three-package catalogue. Repeating startup reuses the same process without installation. Changing a public asset rebuilds, restarts and serves the updated asset without reinstalling. Stop, cloud binding/message and occupied-port handling are checked; an unrelated HTTP service remains alive. Separate fingerprint coverage includes image and sound changes.

The browser suite covers the shipped games, local/API-blocked play, network seats/reconnect, saves, undo, board interaction and phone layouts. Launcher tests use temporary isolated files and do not stop a user's normal launcher server.

The three conversation routes were reviewed against the designer's requested flow. We have not run an actual Claude conversation or tested the designer's desktop installation. CLAUDE.md provides instructions to the coding assistant, not a deterministic built-in chat UI.

## Boundaries

Node 22.12+ and npm must already be available; the launcher installs project dependencies, not operating-system software. Package installation needs registry access. Cloud-mode testing establishes binding and truthful messages, not a particular provider's externally accessible preview. A remote session still needs a verified forwarded/preview route.

The existing prototype game scope and prior designer-acceptance boundaries remain unchanged. Creative workflow instructions facilitate source implementation; they do not make every possible game mechanic a prebuilt setting. Designer usability acceptance is still outstanding.
