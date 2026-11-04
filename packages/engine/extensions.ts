import type { GamePackage, Match } from "./types.ts";
/** Trusted source extensions only. Registration is a developer-build operation, never an archive entry point. */
export type ScheduledOperation = (context: {
  package: GamePackage;
  match: Match;
  random: () => number;
  emit: (type: string, data: any) => void;
}) => void;
const operations = new Map<string, ScheduledOperation>();
export function registerScheduledOperation(
  name: string,
  operation: ScheduledOperation,
) {
  if (!/^[a-z][a-z0-9-]*$/.test(name) || operations.has(name))
    throw Error("Invalid or duplicate operation");
  operations.set(name, operation);
}
export const hasScheduledOperation = (name: string) => operations.has(name);
export function runScheduledOperation(
  name: string,
  context: Parameters<ScheduledOperation>[0],
) {
  const op = operations.get(name);
  if (!op) throw Error("Unsupported scheduled operation " + name);
  op(context);
}
registerScheduledOperation(
  "flood",
  ({ package: p, match: s, random, emit }) => {
    const candidates = p.rules.floodTiles.filter((t) => {
      const tile = p.tiles.find((x) => x.id === t);
      return (
        tile &&
        (p.areas.find((a) => a.id === tile.area)?.shared ||
          s.core.owners[tile.area]) &&
        !Object.values(s.core.entities).some((e) => e.tile === t && !e.carrier)
      );
    });
    if (candidates.length) {
      const t = candidates[Math.floor(random() * candidates.length)];
      s.core.effects.push({
        tile: t,
        expires: s.core.round + p.rules.floodDuration,
        source: "system",
      });
      emit("effect.applied", { tile: t });
    } else emit("system.noop", {});
  },
);
