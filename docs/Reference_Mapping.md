# Reference and prototype parity

Read-only original: jjauslander/swarm-board-game at 6c57ddac2b2deaf4fc62df2b6a7a0ce1705d712a. No runtime/build/test imports refer to that repository.

| Included behaviour | Reference | Engine evidence |
|---|---|---|
| 259 tiles, centres and axial directions | src/domain/geometry.ts | generator constants and reciprocal topology test |
| Area ownership and separate hive AP/support | types.ts, state.ts, multiplayer brief | independent clocks, carried support tests |
| Steps, friendly jumps, Queen territory | movement.ts, accepted movement rulings | engine routes, Queen boundary tests |
| Bumblebee staged one/two segments, one AP | application/bumblebee.ts | browser actual taps, atomic Undo test |
| Occupied Flower collection/free exit | movement.ts and later M3 playtest supersessions | occupied Flower zero-AP boundary test |
| Queen production owner and free departure | session.ts, economy.ts | opposing decision, browser save/load, network host-restart tests |
| Worker placement and support; Honey placement | economy.ts | placements and support tests; production browsers |
| Pollen Runs/capacity | README, session.ts and current briefs | explicit phase and individual-loss handling |
| Source-independent saves | persistence.ts as reference only | new schema replay verification |

Prototype setup is new: Queen, Worker, Bumblebee and one Honey Pot per participating hive. This avoids unsupported Royal Jelly/gestation setup. Worker/Honey are the only products. First controller to spend three pollen at controlled Queens wins after departure. That objective is a prototype rule, not original-game victory.

Explicit omissions: combat, theft/evasion, Swarms, Royal Jelly, walls, gestation, succession, conquest, collapse, voting, full M4 victory, advanced AI and old save migration.

Implementation reads current source for authoritative post-playtest behaviour; historical M2 build report descriptions may be superseded, particularly free Flower/Queen departure and cargo capacity. Current rule briefs/designer rulings retain precedence over source.

Representation differences: immutable package topology replaces a global BOARD; opaque IDs replace coordinate IDs; stable numeric directions preserve jumps. The current packages use shared Garden but assign shared areas to an explicit system participant with scheduled events. It has no human seat or default victory condition.
