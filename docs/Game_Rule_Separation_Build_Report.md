# Game-rule separation build report

5 November 2026. Designer authorized execution of AGENTS.md and the Game Rule Separation Implementation Brief. Baseline bd22e6e; original Swarm reference unchanged.

## Result

The common engine now supports trusted game modules. Swarm Basic Prototype and Garden Cycle retain their rules in games/swarm-basic. Outpost Capture has an independent 19-cell map, direct Scout ownership, Fuel, deployment, Claim victory and round-limit draw. The renderer, authority and modkit consume generic contracts.

The Signal Relay source starter adds another resource/action set, opposing accept/reflect decision and outcome through the same interface. Its pending choice restores in a new process. The starter was copied and built separately without common implementation changes. Outpost was bundled without any Swarm implementation in its dependency graph and completed a match.

Novel mechanics require trusted source and an application rebuild. Data-only archives work against installed exact modules. No arbitrary-code sandbox, rule editor or universal DSL is claimed.

## Commands and actual outcomes

| Check | Result |
|---|---|
| Initial npm test / npm run build | 33 tests passed; build passed |
| npm ci | Passed; 39 packages installed, zero audit vulnerabilities |
| Final npm test | 49 passed, zero failed/skipped in the final clean checkout; approximately 7.86 seconds |
| npm run build | TypeScript and Vite passed |
| npm run test:e2e -- --reporter=json | 15 passed; zero unexpected/skipped/flaky; approximately 28.2 seconds |
| npm run benchmark | Both existing Swarm fixtures plus Outpost below 20 ms p95 |
| Actual CLI and stdio MCP workflows | Create/edit/validate/simulate/pack/preview passed; each route's Outpost archive imported and played to victory in a browser |
| Original repository Git status | Clean; no edits made |
| Source scan for original checkout references in packages/games/scripts/templates | No matches |
| Fresh checkout verification | Passed at 4d570c4: npm ci --offline, build, all 49 tests; Git worktree unchanged |

npm ci reported unapproved esbuild postinstall scripts in the local npm configuration; installed platform binaries worked and all build/bundle checks passed. No permission setting was changed.

## Acceptance traceability

| Gate | Evidence |
|---|---|
| A: game-independent types and dependency direction | architecture.test.ts; engine has no game imports/semantic fields; composition/catalogue are explicit |
| A: independent module/registration | module-extension.test.ts; per-instance Runtime and Swarm operation registries; duplicate/missing module checks |
| A: Outpost without Swarm | outpost.test.ts creates an isolated bundle, checks its metafile and executes a complete game |
| B: preserved Swarm subset | original engine/boundary regressions retained through a typed module adapter |
| B: pure queries, failed steps, RNG/ID rollback and work limits | Outpost and independent-module fault-injection tests; 256-event bound |
| B: pending choice, actor separation, transaction Undo, outcome ordering | Swarm Queen/departure regressions and Signal Relay fresh-process restore |
| B: Outpost rules and boundaries | direct resource/cost, occupancy, deployment limits, claim, draw and final-round precedence assertions |
| C: identities, invalid saves, replay | source graph change without version change; source/startup checks; missing build/archive failures; fresh-process exact replay |
| C: network recovery/privacy | real HTTP forged/stale/duplicate tests, private responses, Swarm pending restart, Outpost restart; two browser seats for both families |
| D: complete play and desktop/phone | Swarm choice-to-victory and Outpost deploy/undo/save/win at 1280 and 390 widths; screenshots reviewed |
| D: presentation/audio/lifetime | canvas staging, sound/mute/history tests; ten alternating Swarm/Outpost cycles; active six-hive RAF sample |
| E: source and data authoring | copied starter build; scoped CLI/MCP roundtrips; actual authored archive-to-browser victory |
| F: install/build/full suites/performance | commands above and machine-readable verification artifacts |

## Extraction map

| Original coupling | Destination |
|---|---|
| Pollen, cargo, support, production, departure, capacity and hive phases | games/swarm-basic/rules.ts and types.ts |
| Global default flood operation | instance-scoped games/swarm-basic/extensions.ts |
| Flower/Queen bot | games/swarm-basic/bot.ts, projected input only |
| Authority revisions, transactions, RNG/IDs, save/replay | packages/engine |
| Hive/bee labels, counters, route staging hints | module setup and observation descriptors |
| Installed implementations and offline data | packages/composition and client/local-catalog |
| Executable-source identity | explicit source manifest plus scripts/module-identities.ts |

The public interface is documented in Module_API.md; source/data workflows are in Modding_Guide.md.

## Independent-extension proof history

Common file hashes were captured before adding Signal Relay. Its four initial tests passed with those files unchanged. Subsequent broader browser testing exposed an unrelated rapid-input race: selection could be overwritten while a preceding network command completed. Common client submission/polling handling was corrected, and unsupported staged controls were hidden for Outpost. No module API or starter change was needed.

The pre-fix hashes remain in verification/module-boundary-before-browser-fix.json. The final baseline includes those UI corrections. All TypeScript was formatted for maintainability; esbuild-normalized common outputs were compared before/after and were identical, then whitespace hashes were refreshed. The final extension tests again pass. This distinguishes the original no-edit extension proof from later common UI maintenance.

## Performance

Windows / AMD Ryzen 5 5600X / Node 24.20.0 / Edge 156.0.4314.58. Swarm fixtures each perform 100 accepted operations (80 moves, 20 ends). Outpost samples 100 operations over repeated complete games. Seed 12345.

| Fixture | Query median / p95 ms | Command median / p95 ms | Restore |
|---|---|---|---|
| Two Swarm hives | 1.72 / 2.54 | 3.00 / 4.17 | 307 ms, 100-input history |
| Six Swarm hives, five owners | 2.41 / 2.78 | 3.69 / 4.30 | 367 ms, 100-input history |
| Outpost | 0.057 / 0.064 | 0.278 / 0.362 | 3.24 ms, ten-input complete game |

Swarm bot completes after 42 accepted commands; Outpost after 10. The measured Swarm simulation is 462 ms. Current Swarm archive is 5,926 bytes; sample process RSS about 120 MB. These are reproducible prototype fixtures, not AI-strength claims.

Active six-hive Edge frame sample: median 10.4 ms, p95 11.1 ms, no intervals above 50 ms. Ten alternating cross-game cycles retain one document and 33 listeners; menu nodes alternate with game setup size (451/306), with no canvas after exit. Heap rose from 6.23 to 7.15 MB; cycle-four-to-ten growth was 0.51 MB. This bounded warm-up sample is not proof about every long session.

Localhost acknowledgement sample: five accepted commands, median 19.74 ms and p95 25.01 ms. It is a small local sample, not a LAN/internet prediction. Raw benchmark, browser, frame, lifetime and network evidence is under docs/verification/separation-*.

## Failures corrected during development

- Initial adapter typing/fixture compile issues and two test-string escaping errors were fixed before final checks.
- An old preview host rejected schema-2 packages; the known previous preview process was stopped and rebuilt tests used current code.
- Source-digest path normalization was corrected for Windows; deterministic transitive-change tests pass.
- The source starter's adjacent package.json caused Node to interpret TypeScript under the wrong module scope; its definition is game.json until copied into mods/.
- Network browser testing exposed a genuine rapid-input/polling race, corrected as described above.
- Screenshot review led to hiding unsupported staging controls and clearer base colours.
- Clean-checkout testing found identity generation unnecessarily rewrote matching CRLF files. Generation now preserves matching bytes/timestamps; a focused regression and fresh checkout verify a clean Git status.

## Compatibility and remaining limits

Schema-1 packages/saves are not migrated; reopen them at 2c6d11c. Schema-2 pins source/module identity. Unavailable host records remain preserved when new matches are saved.

Source modules are trusted, finite developer code. The event budget cannot preempt infinite synchronous callbacks. Source changes require rebuilding/restarting, and novel modules must accompany their data archives. Private data/decisions/events are supported; general hidden-board gameplay remains deferred.

Full Swarm, advanced bots, 3D, public hosting/accounts, designer appearance/audio/balance acceptance and physical-device acceptance remain outside this delivery.

## Final standalone checkpoint and completion

Implementation commits: bcdcaa1 (rule separation), 4d570c4 (idempotent Windows identity generation). A fresh Git clone of 4d570c4 ran npm ci --offline, npm run build and npm test successfully with a Node filesystem-read guard denying access to the original Swarm root. A direct reference-read probe confirmed the guard rejected access. All 49 tests passed and the clone's Git worktree stayed clean. Static runtime/source scans also found no reference-checkout paths.

The final browser suite passed 15 tests before the generation-only correction; the subsequent build emitted identical browser asset names/content. That correction did not change runtime, modules or UI. The 15-test evidence remains applicable. Final screenshots were inspected at desktop and 390-pixel width.

All mandatory implementation acceptance gates A–F have recorded passing evidence. Designer playtesting/appearance/audio/balance and physical-device acceptance remain separate. No original Swarm files were edited.
