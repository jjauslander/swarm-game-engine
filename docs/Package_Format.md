# Package format v2

A data folder contains package.json. A .hexmod is a ZIP containing exactly that file. Visuals are procedural symbols, colours and finite synthesized cues. No scripts, HTML or asset filesystem are executed/extracted.

Common fields: schema 2; safe id/name/version; engine "2"; author/description/license/help; dependencies with exact id/version/SHA-256 digest; capabilities; tile topology/areas; presentation; module identity. Modules add runtime-validated fields. Swarm has types/rules/setup; Outpost has rules/bases/setup with direct Scout ownership. Neither game's fields are mandatory in the other.

Module identity has id, API 1, version and a SHA-256 source-artifact digest. The digest covers normalized transitive local TypeScript source plus common runtime; generated constants are excluded to avoid self-reference. This identifies the executable source artifact interpreted/bundled, not a manually maintained version string. npm run identities generates packages/composition/identities.ts and stamps checked-in packages. An explicit source manifest controls discovery; imported archives cannot add entries.

Host/CLI/MCP verify source identity at startup. Build/dev verify it too; dev disables hot replacement. Changing rules without bumping the version changes the digest. Old matches cannot silently use replacement rules. Recipients need the matching trusted build; retain old builds for old saves.

Tiles have stable opaque IDs, area, axial coordinates, terrain and six reciprocal directional edges. Coordinates and logical connections are distinct. Validation rejects missing/duplicate IDs and invalid links. Topology stays static during a match.

The common validator checks metadata, dependencies, capabilities, topology and finite cues. Each module validates its configuration. Absent/mismatched modules fail before creation/import replacement.

ZIP limits: 2 MB compressed, 5 MB expanded, one package.json entry, no symlinks/traversal. Dependency resolution rejects cycles, missing exact versions and conflicts. Invalid imports preserve working packages/games.

Browser-local imports and host installations are separate. Public import rejects private fixtures; private-data maps are excluded from catalogue responses. Checkpoints/seat credentials are separate from exported player saves.

Save schema 2 rejects schema-1 files without migrating them; reopen those using commit 2c6d11c. Incompatible stored records are retained when other matches are persisted. There is no active-match hot reload.
