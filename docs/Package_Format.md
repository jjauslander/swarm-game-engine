# Package format v1

A development folder has one package.json. Distribution is a .hexmod ZIP containing exactly that file. Initial packages contain procedural presentation definitions (symbols, colours) and generic synthesized sound support, not arbitrary embedded asset trees. Unsupported archive entries are rejected rather than extracted.

Required fields:
- schema: 1; id: lowercase package identifier; name; version: exact three-component semver; engine: "1".
- author, description and license: nonempty authorship/description/license metadata for the package.
- dependencies: exact id/version/SHA-256 digest triples. Both examples are complete standalone packages with no dependencies.
- capabilities: supported capability names.
- tiles: stable ID, area ID, axial q/r, terrain and six ordered directional edge IDs/null.
- areas: stable ID and shared flag.
- types: label/symbol, cargo capacity, movement segments, population count, optional queen/resource flags.
- setup: settled entity records with identity/type/origin/tile and empty cargo.
- rules: per-activation AP, support per pot, victory threshold, allowed product types, system flood interval/duration and eligible tile IDs. Optional systemOperation selects a registered source operation.
- presentation: background/flood colours and optional finite synthesized event cues (frequency/duration); help: player-facing scope and rules.
- optional privateData: host-only private value keyed by participant. Such fixtures cannot be imported through the public host import endpoint.

Manifest and references are validated before installation. Hash the complete canonical package for its digest. Running matches/saves retain the exact digest. Installing altered bytes under an existing id/version is rejected by the host.

The compatibility boundary is deliberately narrow. New gameplay families can require trusted source operations, a new build or a schema version. Changing data is not unlimited programming. The two examples work with the same supported operations without branches on their IDs.

Source extension API: registerScheduledOperation(name, callback) in packages/engine/extensions.ts. Register before validation/match creation on every authority, simulation and local-client build. Its deterministic context supplies package, copied match, seeded random and bounded event emission. A package can select it through rules.systemOperation. Unsupported names fail validation. Trusted callbacks must be finite, deterministic and avoid platform APIs; they are not a security sandbox.

ZIP limits: two MB compressed, five MB declared expansion; only package.json accepted. No executable archive entries, file extraction, install hooks, absolute paths or traversal. The parser is pinned to a patched release. Dependency resolution requires matching installed packages and rejects cycles; untrusted executable scripts and arbitrary asset bundles are deferred.

The browser stores local imports separately from the host's installed packages. Network hosts must have the matching package installed before creating/joining the match. A browser-only game cannot start the MCP process; use the local Node companion.
