# Initial engine build report

5 November 2026 · Revision 1 · Sol 6.1 execution

## Outcome and scope

Implemented the initial playable engine in swarm-game-engine following the designer's explicit execution instruction. Swarm Basic Prototype and Garden Cycle are declarative packages loaded through the same runtime. The original game checkout remains unchanged; its geometry/rule behaviour was used read-only as documented in Reference_Mapping.md.

The engine has deterministic actions/decisions, per-area activations, explicit system ownership, atomic local Undo, pending-choice save/replay, filtered observations, local bots, authority-run network bots, package import/select/play, shared CLI and real stdio MCP authoring/preview tools.

The example retains the original 259-cell shape but uses the brief's bounded setup, two production products and prototype objective. Full Swarm parity is deliberately not claimed. Flat graphics and basic synthesized cues are procedural; no Blender/Babylon or large recordings are required.

## Commands actually run

| Command | Result |
|---|---|
| npm install; later npm ci | Passed; lockfile clean installation on Node 24.20.0 |
| npm run build | Passed TypeScript validation and Vite production build |
| npm test | 33 passed, zero skipped/failed; final run approximately 2.3 seconds |
| npm run test:e2e -- --reporter=json | 9 passed, zero skipped/unexpected/flaky; final run approximately 15 seconds in Edge |
| npm run benchmark | Passed both reproducible workload fixtures; raw JSON retained |
| npm run mod -- simulate mods/swarm-basic-prototype/package.json 500 | Winner p1 after 42 accepted decisions |
| npm audit during installation | Initial two advisories addressed; subsequent clean install reported zero vulnerabilities |
| Git status of original reference checkout | Clean; no original-game modifications |

The test suite exercises actual Node child processes for MCP and network authority recovery. The MCP test creates/edits/validates/simulates/packs a variant, starts a real preview host, verifies its HTTP page and installed package, then cleans up the process it started. Network tests restart the host mid-production, retain seat identity, reject stale/duplicate/forged input, verify private information through real HTTP responses and complete a bot-controlled match.

The browser suite uses separate contexts for network seats and actual canvas taps for Bumblebee staging. Desktop and 390×844 flows exercise production, a saved pending decision, free departure and delayed victory. Browser API requests are deliberately blocked in the local-mode test.

## Acceptance traceability

| Gate | Implemented in | Verification |
|---|---|---|
| A: deterministic simulation, RNG/IDs, replay | packages/engine | replay/save/rejection tests |
| A: decision owner distinct from active owner | engine decisions | opposing Queen tests, HTTP host restart, browser production |
| A: complete transaction Undo and zero-AP departure | engine pending/undo | atomic action, delayed win and actual board tap tests |
| A: effect ordering, expiry and failure rollback | scheduled operation registry | flood timing, bounded-effect failure test |
| A: multiple owned area activations | core slots/clocks | independent AP/clocks fixture |
| B: included movement/economy subset | routes, placements, cargo, support | Queen boundary, Flower transit, Bumblebee, support, Pollen Runs/capacity tests |
| B: casualty cargo boundary | capacity resolution | vacated-cell drop regression |
| B: complete playable outcome | package goal and bot policy | both packages finish identical seeded matches |
| C: portable packages and independent topology | validator, ZIP codec and modkit | roundtrip, malformed archive/schema, small-board and missing dependency tests |
| C: matching versions/configuration | SHA-256 identity, dependency resolution | save mismatch and authority import/join checks |
| D: authority, reconnect, privacy | HTTP host and filtered views | real restart during opposing decision, two-context browser join/reconnect, private HTTP fixture |
| D: bot/controller persistence | saved controller configuration, host bot loop | saved controller test and complete network-bot outcome |
| E: flat desktop/phone controls | Pixi client and HTML controls | nine browser tests and reviewed screenshots |
| E: sound, mute, Undo audio | finite package-configured cues | real AudioContext oscillator interception test; historical cues not replayed |
| E: local offline operation | bundled packages and pure browser codec | all API traffic blocked test |
| E: resource lifecycle | board destruction and finite voices | ten package-switch cycles, CDP heap/listener evidence |
| F: common CLI/MCP services | modkit and wrappers | real stdio tool workflow and actual preview host |
| F: independent checkout | repository dependencies/configuration | clean npm ci/build; no source imports or build requirements reference original checkout |

Performance evidence and screenshots are under docs/verification. Raw transient traces and process/test data remain ignored under .runtime and test-results.

## Final performance sample

Windows, AMD Ryzen 5 5600X, Node 24.20.0. Each headless fixture has 100 operations: 80 moves and 20 activation ends, with legal-action query timing recorded separately. These are measurements on this desktop, not universal device promises.

| Fixture | Query median / p95 | Command median / p95 | Save restore |
|---|---|---|---|
| Two participating hives | 1.27 / 1.88 ms | 1.13 / 1.94 ms | 119 ms for 100-input history |
| Six hives, five players, one owner with two hives | 1.97 / 2.49 ms | 2.20 / 2.66 ms | 180 ms for 100-input history |

Both representative p95 targets are below the brief's 20 ms threshold. The seeded bot simulation completes 42 accepted decisions in approximately 169 ms. The base archive is 5,828 bytes. This is a small deterministic prototype controller, not proof of strong AI.

The final Edge six-hive frame sample includes a 30-step camera drag during 180 RAF intervals: median 10.4 ms, p95 11.2 ms, zero intervals above 50 ms in that sample. This meets the desktop frame-time target for this fixture; no physical-phone result is claimed.

Ten alternating load/play/menu cycles, with GC for diagnostic comparability: one document, 430 nodes and 33 JS event listeners at every menu sample; no canvas remains after exit. Used heap grows from about 5.98 MB to 6.91 MB, within the bounded warm-up allowance (growth from cycle four is about 0.55 MB). This is a short-run retained-resource check, not proof against every long-session/GPU/audio leak.

Network acknowledgement metrics are a small localhost sample from the recovery test; see verification/network-metrics.json. They are not internet/LAN latency predictions.

## Failures found and corrected

- Initial new-test syntax error and a small-board fixture referencing removed tiles were fixed before passing checks.
- Initial browser assumption selected Garden Cycle rather than the desired default; Swarm Basic Prototype is now the default.
- Historical development checkpoints from before schema edits prevented startup. Incompatible files are retained/skipped; no legacy migration is promised.
- Screenshot review found six-hive camera clipping; fitting now uses visible board bounds, caches the result, and observes the actual board container when controls change its height.
- A six-hive p95 sample slightly exceeded 20 ms because route previews copied full accumulated history. Pure simulation forks now copy current state only; mixed movement benchmarks above supersede the earlier turn-only/slow samples.
- Review found casualty pot dropping excluded the vacated source cell. The casualty is removed before nearest-free placement and the released pot excludes itself from occupancy; a dedicated regression passes.
- Audio first-enable, mute, disposal/backgrounding and historical-event filtering were corrected and browser-tested.
- Initial fflate/Vite advisories were resolved using patched compatible releases.

## Honest limits and follow-up

Designer appearance, listening, gameplay/balance and physical-device acceptance remain outstanding. Automated desktop/phone-viewport tests do not supply those decisions.

This version supports a narrow, documented package schema and trusted source extensions. It does not promise arbitrary downloaded scripts, arbitrary asset trees, unrestricted menu programming, universal game rules, strong bots or fog-of-war board entities. Participant-private data and private decision/event filtering are implemented/tested; new hidden-board mechanics require a later observation extension.

Networking is local/LAN-oriented, polling-based and uses privately shared seat credentials. Public account authentication, TLS deployment, matchmaking and a native installer remain deferred. The MCP service is a local Node companion, not a process hosted inside a browser tab.

Replay-based save validation grows with match history. Current fixture costs are reported rather than extrapolated to unlimited matches. Source-based scheduled extensions are trusted code and must obey the pure/finite-operation contract.

Prototype implementation and the automated checks recorded here are ready for designer review; full Swarm and designer acceptance remain separate.
