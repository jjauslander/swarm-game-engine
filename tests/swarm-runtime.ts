import { runtime } from "../packages/composition/index.ts";
import type { GamePackage, Core, Match } from "../games/swarm-basic/types.ts";
import type { Controllers, Command } from "../packages/engine/types.ts";
export {
  copy,
  stable,
  hash,
  tile,
  decisionOwner,
} from "../packages/engine/index.ts";
export { routes, population, support } from "../games/swarm-basic/rules.ts";
export const create = (
  p: GamePackage,
  d: string,
  o: Record<string, string>,
  seed = 12345,
  network = false,
  controllers: Controllers = {},
) => runtime.create<GamePackage, Core>(p, d, o, seed, network, controllers);
export const actions = (p: GamePackage, s: Match, who: string): any[] =>
  runtime.actions(p, s, who);
export const submit = (
  p: GamePackage,
  s: Match,
  who: string,
  e: { matchId: string; revision: number; command: Command },
) => runtime.submit(p, s, who, e);
export const view = (p: GamePackage, s: Match, who: string): any =>
  runtime.view(p, s, who);
export const snapshot = (p: GamePackage, s: Match) => runtime.snapshot(p, s);
export const restore = (p: GamePackage, d: string, text: string) =>
  runtime.restore<GamePackage, Core>(p, d, text);
export const replay = (p: GamePackage, s: Match) => runtime.replay(p, s);
