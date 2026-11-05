import { tile } from "../../packages/engine/services.ts";
export function choose(p: any, observation: any) {
  const s = { core: observation };
  const all = observation.actions;
  const who = observation.turn;
  if (s.core.decision)
    return all.find((x) => x.option?.startsWith("honey:")) ?? all[0];
  const dist = (a: any, b: any) =>
    Math.max(
      Math.abs(a.q - b.q),
      Math.abs(a.r - b.r),
      Math.abs(a.q + a.r - b.q - b.r),
    );
  const scored = all
    .filter((c) => c.type === "move")
    .map((c) => {
      const e = s.core.entities[c.actor];
      const targets = p.tiles.filter((t) =>
        e.pollen
          ? Object.values(s.core.entities).some(
              (q: any) =>
                p.types[q.type].queen &&
                q.tile === t.id &&
                s.core.owners[q.origin] === who,
            )
          : t.terrain === "flower",
      );
      const d = (t: string) =>
        Math.min(...targets.map((x) => dist(tile(p, t), x)));
      return { c, score: d(e.tile) - d(c.route.at(-1)) };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        JSON.stringify(a.c).localeCompare(JSON.stringify(b.c)),
    );
  return scored[0]?.score > 0 ? scored[0].c : all[0];
}
