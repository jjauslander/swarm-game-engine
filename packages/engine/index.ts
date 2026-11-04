import { runScheduledOperation } from "./extensions.ts";
import { copy, RuleError } from "./types.ts";
import type { GamePackage, Match, Core, Entity, Event } from "./types.ts";
export * from "./types.ts";
export const stable = (v: any): string =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : x,
  );
export function hash(v: any) {
  let h = 2166136261;
  for (const c of stable(v)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
const fail = (message: string): never => {
  throw new RuleError("INVALID_ACTION", message);
};
export const active = (s: Match) => s.core.slots[s.core.index];
export const owner = (s: Match, e: Entity) => s.core.owners[e.origin];
export const at = (s: Match, t: string, except = "") =>
  Object.values(s.core.entities).filter(
    (e) => e.tile === t && e.id !== except && !e.carrier,
  );
export const tile = (p: GamePackage, t: string) =>
  p.tiles.find((x) => x.id === t)!;
export const playable = (p: GamePackage, s: Match, t: string) =>
  !!tile(p, t) &&
  (p.areas.find((a) => a.id === tile(p, t).area)?.shared ||
    !!s.core.owners[tile(p, t).area]);
export const position = (s: Match, e: Entity) =>
  e.carrier ? s.core.entities[e.carrier].tile : e.tile;
export const population = (p: GamePackage, s: Match, a: string) =>
  Object.values(s.core.entities)
    .filter((e) => e.origin === a)
    .reduce((n, e) => n + p.types[e.type].population, 0);
export const support = (p: GamePackage, s: Match, a: string) =>
  Object.values(s.core.entities).filter(
    (e) => p.types[e.type].resource && tile(p, position(s, e)).area === a,
  ).length * p.rules.support;
export const cargo = (p: GamePackage, s: Match, e: Entity) =>
  e.pollen +
  Object.values(s.core.entities).filter((x) => x.carrier === e.id).length;
export const decisionOwner = (s: Match) =>
  s.core.decision?.owner ?? s.core.owners[active(s)];
function emit(s: Match, type: string, data: any, audience?: string) {
  s.events.push({
    seq: (s.events.at(-1)?.seq ?? 0) + 1,
    revision: s.revision + 1,
    transaction: s.core.allocator,
    type,
    data,
    ...(audience ? { audience } : {}),
  });
}
function id(s: Match) {
  return "e" + ++s.core.allocator;
}
function random(s: Match) {
  let n = s.core.rng;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  s.core.rng = n >>> 0;
  return s.core.rng / 4294967296;
}
function collect(p: GamePackage, s: Match, e: Entity) {
  if (tile(p, e.tile).terrain === "flower") {
    let n = Math.max(0, p.types[e.type].cargo - cargo(p, s, e));
    e.pollen += n;
    if (n) emit(s, "resource.collected", { entity: e.id, count: n });
  }
}
function moveEntity(p: GamePackage, s: Match, e: Entity, t: string) {
  let from = e.tile;
  e.tile = t;
  for (const x of Object.values(s.core.entities))
    if (x.carrier === e.id) x.tile = t;
  collect(p, s, e);
  emit(s, "entity.moved", { entity: e.id, from, to: t });
}
export function segments(
  p: GamePackage,
  s: Match,
  e: Entity,
  from = e.tile,
  departure = false,
): { to: string; over?: string }[] {
  const out: any[] = [];
  for (let d = 0; d < 6; d++) {
    const near = tile(p, from)?.edges[d];
    if (!near || !playable(p, s, near)) continue;
    const mid = at(s, near, e.id);
    const allowed = (t: string) =>
      !s.core.effects.some((f) => f.tile === t) &&
      (!p.types[e.type].queen || tile(p, t).area === e.origin);
    const land = (t: string) => {
      const occ = at(s, t, e.id);
      if (!allowed(t)) return false;
      if (!occ.length) return true;
      if (departure) return false;
      return (
        !p.types[e.type].queen &&
        ((tile(p, t).terrain === "flower" &&
          occ.every((x) => !p.types[x.type].resource)) ||
          (e.pollen > 0 && occ.length === 1 && p.types[occ[0].type].queen))
      );
    };
    if (land(near)) out.push({ to: near });
    const friendly =
      mid.length > 0 &&
      mid.every((x) =>
        p.types[x.type].resource
          ? p.areas.find((a) => a.id === tile(p, near).area)?.shared ||
            tile(p, near).area === e.origin
          : owner(s, x) === owner(s, e),
      );
    const far = tile(p, near).edges[d];
    if (friendly && far && playable(p, s, far) && land(far))
      out.push({ to: far, over: near });
  }
  return out;
}
export function simulationFork(s: Match): Match {
  return {
    ...s,
    core: copy(s.core),
    pending: null,
    undo: [],
    events: [],
    inputs: [],
  };
}
export function routes(p: GamePackage, s: Match, actor: string) {
  const e = s.core.entities[actor];
  if (
    !e ||
    (s.core.phase === "pollen" &&
      (!s.core.eligible.includes(e.id) || e.pollen < 1)) ||
    p.types[e.type].resource ||
    e.origin !== active(s) ||
    s.core.decision ||
    s.core.winner ||
    s.core.ap < 1
  )
    return [];
  const out: any[] = [];
  function walk(n: Match, path: string[], depth: number) {
    if (depth > 2) return;
    const a = n.core.entities[actor];
    for (const seg of segments(p, n, a)) {
      const next = simulationFork(n),
        b = next.core.entities[actor],
        occ = at(next, seg.to, actor);
      moveEntity(p, next, b, seg.to);
      const route = [...path, seg.to];
      if (occ.some((x) => p.types[x.type].queen)) {
        if (segments(p, next, b, b.tile, true).length) out.push(route);
        continue;
      }
      if (occ.length && tile(p, seg.to).terrain === "flower") {
        for (const exit of segments(p, next, b, b.tile, true))
          out.push([...route, exit.to]);
        continue;
      }
      out.push(route);
      if (depth < p.types[b.type].segments) walk(next, route, depth + 1);
    }
  }
  walk(s, [], 1);
  return out;
}
function decision(
  p: GamePackage,
  s: Match,
  kind: any,
  actor: string,
  who: string,
  queen?: string,
) {
  s.core.decision = { id: id(s), owner: who, kind, actor, queen, options: [] };
  refresh(p, s);
  emit(s, "decision.requested", { id: s.core.decision.id, kind }, who);
}
function placements(
  p: GamePackage,
  s: Match,
  q: Entity,
  type: string,
  visitor: Entity,
) {
  const free = p.tiles
    .filter(
      (t) =>
        t.area === q.origin &&
        !at(s, t.id).length &&
        !s.core.effects.some((f) => f.tile === t.id),
    )
    .map((t) => t.id)
    .filter((t) => {
      const n = simulationFork(s);
      n.core.entities["@"] = {
        id: "@",
        type,
        origin: q.origin,
        tile: t,
        pollen: 0,
        carrier: null,
      };
      return (
        segments(p, n, n.core.entities[visitor.id], visitor.tile, true).length >
        0
      );
    });
  if (p.types[type].resource) return free;
  const reached = new Set([q.tile]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of Object.values(s.core.entities))
      if (
        e.origin === q.origin &&
        !p.types[e.type].resource &&
        !reached.has(e.tile) &&
        [...reached].some((t) => tile(p, t).edges.includes(e.tile))
      ) {
        reached.add(e.tile);
        changed = true;
      }
  }
  const connected = free.filter((t) =>
    [...reached].some((r) => tile(p, r).edges.includes(t)),
  );
  const distance = (t: string) =>
    Math.max(
      Math.abs(tile(p, t).q - tile(p, q.tile).q),
      Math.abs(tile(p, t).r - tile(p, q.tile).r),
      Math.abs(
        tile(p, t).q + tile(p, t).r - tile(p, q.tile).q - tile(p, q.tile).r,
      ),
    );
  const min = Math.min(...connected.map(distance));
  return connected.filter((t) => distance(t) === min);
}
function refresh(p: GamePackage, s: Match) {
  const d = s.core.decision;
  if (!d) return;
  const a = s.core.entities[d.actor];
  let options: any[] = [];
  if (d.kind === "departure")
    options = segments(p, s, a, a.tile, true).map((x) => ({
      id: x.to,
      label: "Depart " + x.to,
      command: { type: "depart", to: x.to },
    }));
  if (d.kind === "production") {
    const q = s.core.entities[d.queen!];
    options = [
      { id: "keep", label: "Keep remaining pollen", command: { type: "keep" } },
    ];
    if (a.pollen > 0)
      for (const product of p.rules.products) {
        if (
          p.types[product].population &&
          population(p, s, q.origin) + p.types[product].population >
            support(p, s, q.origin)
        )
          continue;
        for (const to of placements(p, s, q, product, a))
          options.push({
            id: product + ":" + to,
            label: p.types[product].label + " at " + to,
            command: { type: "produce", product, to },
          });
      }
  }
  if (d.kind === "capacity")
    options = Object.values(s.core.entities)
      .filter((e) => e.origin === active(s) && p.types[e.type].population)
      .map((e) => ({
        id: e.id,
        label: "Remove " + e.id,
        command: { type: "cull", entity: e.id },
      }));
  d.options = options;
  if (!options.length) fail("No legal continuation");
}
function finish(p: GamePackage, s: Match) {
  if (s.core.decision) return;
  if (s.pending) {
    s.undo.push(s.pending);
    s.undo = s.undo.slice(-30);
    s.pending = null;
  }
  const winners = Object.keys(s.core.score)
    .filter((x) => s.core.score[x] >= p.rules.goal)
    .sort();
  if (winners.length) {
    s.core.winner = winners[0];
    emit(s, "outcome.declared", { winner: winners[0] });
  }
}
function begin(p: GamePackage, s: Match) {
  const a = active(s);
  s.core.ap = p.rules.ap;
  s.core.clocks[a] = (s.core.clocks[a] ?? 0) + 1;
  for (const e of Object.values(s.core.entities))
    if (e.origin === a && !p.types[e.type].resource) collect(p, s, e);
  s.core.phase = "action";
  s.core.eligible = Object.values(s.core.entities)
    .filter((e) => e.origin === a && e.pollen > 0)
    .map((e) => e.id);
  if (population(p, s, a) > support(p, s, a)) {
    if (s.core.eligible.length) {
      s.core.phase = "pollen";
      emit(s, "activation.started", { area: a, phase: "pollen" });
      return;
    }
    s.core.phase = "capacity";
    const bee = Object.values(s.core.entities).find(
      (e) => e.origin === a && p.types[e.type].population,
    )!;
    decision(p, s, "capacity", bee.id, s.core.owners[a]);
  }
  emit(s, "activation.started", { area: a, owner: s.core.owners[a] });
}
export function create(
  p: GamePackage,
  digest: string,
  owners: Record<string, string>,
  seed = 12345,
  network = false,
  controllers: Match["controllers"] = {},
): Match {
  const assigned = Object.keys(owners),
    players = [...new Set(Object.values(owners))];
  if (
    players.length < 2 ||
    players.length > 6 ||
    assigned.some((a) => !p.areas.some((x) => x.id === a && !x.shared)) ||
    players.some((x) => !/^p[1-6]$/.test(x))
  )
    fail("Assign two to six players to valid unique areas");
  if (
    Object.entries(controllers).some(
      ([id, c]) =>
        !players.includes(id) || !["human", "bot", "external"].includes(c),
    )
  )
    fail("Invalid controller configuration");
  const configured = Object.fromEntries(
    players.map((id) => [id, controllers[id] ?? "human"]),
  ) as Match["controllers"];
  const core: Core = {
    participants: Object.fromEntries([
      ...players.map((id) => [id, { id, kind: "player" }]),
      ["system", { id: "system", kind: "system" }],
    ]),
    entities: Object.fromEntries(
      p.setup
        .filter(
          (e) =>
            owners[e.origin] || p.areas.find((a) => a.id === e.origin)?.shared,
        )
        .map((e) => [e.id, copy(e)]),
    ),
    owners: {
      ...copy(owners),
      ...Object.fromEntries(
        p.areas.filter((a) => a.shared).map((a) => [a.id, "system"]),
      ),
    },
    slots: p.areas.filter((a) => owners[a.id]).map((a) => a.id),
    index: 0,
    ap: 0,
    round: 1,
    clocks: {},
    phase: "action",
    eligible: [],
    score: Object.fromEntries(players.map((x) => [x, 0])),
    rng: seed >>> 0 || 1,
    allocator: 1000,
    effects: [],
    winner: null,
    decision: null,
  };
  const s: Match = {
    schema: 1,
    id: "match-" + hash({ digest, owners, seed }),
    packageDigest: digest,
    revision: 0,
    core,
    pending: null,
    undo: [],
    events: [],
    inputs: [],
    initial: { seed, owners: copy(owners), controllers: copy(configured) },
    network,
    controllers: copy(configured),
  };
  begin(p, s);
  return s;
}
export function actions(p: GamePackage, s: Match, who: string): any[] {
  if (s.core.winner || who !== decisionOwner(s)) return [];
  if (s.core.decision)
    return s.core.decision.options.map((x) => ({
      type: "respond",
      decision: s.core.decision!.id,
      option: x.id,
    }));
  const out: any[] = [{ type: s.core.phase === "pollen" ? "phase" : "end" }];
  for (const e of Object.values(s.core.entities))
    if (e.origin === active(s) && !p.types[e.type].resource) {
      for (const route of routes(p, s, e.id))
        out.push({ type: "move", actor: e.id, route });
      if (s.core.ap > 0 && s.core.phase === "action") {
        for (const r of Object.values(s.core.entities))
          if (
            p.types[r.type].resource &&
            !r.carrier &&
            cargo(p, s, e) < p.types[e.type].cargo &&
            tile(p, e.tile).edges.includes(r.tile)
          )
            out.push({ type: "pickup", actor: e.id, resource: r.id });
        for (const r of Object.values(s.core.entities))
          if (r.carrier === e.id)
            for (const t of tile(p, e.tile).edges)
              if (t && playable(p, s, t) && !at(s, t).length)
                out.push({ type: "drop", actor: e.id, resource: r.id, to: t });
      }
    }
  return out;
}
export function submit(
  p: GamePackage,
  s: Match,
  who: string,
  envelope: { matchId: string; revision: number; command: any },
): Match {
  if (envelope.matchId !== s.id || envelope.revision !== s.revision)
    throw new RuleError("STALE_STATE", "Refresh this match before acting");
  const c = envelope.command;
  if (c.type === "undo") {
    if (
      s.network ||
      p.privateData ||
      s.core.decision ||
      !s.undo.length ||
      who !== decisionOwner(s)
    )
      fail("Undo unavailable");
    const n = copy(s);
    n.core = n.undo.pop()!;
    n.revision++;
    n.inputs.push({ actor: who, command: copy(c) });
    emit(n, "history.undone", {});
    return n;
  }
  const trivial =
    ((c.type === "end" && s.core.phase === "action") ||
      (c.type === "phase" && s.core.phase === "pollen")) &&
    !s.core.decision &&
    !s.core.winner &&
    who === decisionOwner(s);
  if (!trivial && !actions(p, s, who).some((x) => stable(x) === stable(c)))
    fail("Choose a current legal action");
  const n = copy(s);
  if (!n.pending) n.pending = copy(n.core);
  if (c.type === "move") {
    const e = n.core.entities[c.actor];
    for (const to of c.route) moveEntity(p, n, e, to);
    n.core.ap--;
    const q = at(n, e.tile, e.id).find((x) => p.types[x.type].queen);
    if (q) decision(p, n, "production", e.id, owner(n, q), q.id);
  } else if (c.type === "respond") {
    const d = n.core.decision!,
      choice = d.options.find((x) => x.id === c.option)!.command,
      a = n.core.entities[d.actor];
    emit(n, "decision.resolved", { id: d.id }, d.owner);
    if (choice.type === "keep") {
      n.core.decision = null;
      decision(p, n, "departure", a.id, owner(n, a));
    }
    if (choice.type === "depart") {
      moveEntity(p, n, a, choice.to);
      n.core.decision = null;
    }
    if (choice.type === "produce") {
      const q = n.core.entities[d.queen!],
        eid = id(n);
      n.core.entities[eid] = {
        id: eid,
        type: choice.product,
        origin: q.origin,
        tile: choice.to,
        pollen: 0,
        carrier: null,
      };
      a.pollen--;
      n.core.score[owner(n, q)]++;
      emit(n, "entity.produced", {
        entity: eid,
        type: choice.product,
        to: choice.to,
      });
      if (!a.pollen) {
        n.core.decision = null;
        decision(p, n, "departure", a.id, owner(n, a));
      } else {
        d.id = id(n);
        refresh(p, n);
      }
    }
    if (choice.type === "cull") {
      const e = n.core.entities[choice.entity];delete n.core.entities[e.id];
      for (const r of Object.values(n.core.entities).filter(
        (x) => x.carrier === e.id,
      )) {
        r.carrier = null;
        const free = p.tiles
          .filter((t) => playable(p, n, t.id) && !at(n, t.id,r.id).length)
          .sort(
            (a, b) =>
              Math.max(
                Math.abs(a.q - tile(p, e.tile).q),
                Math.abs(a.r - tile(p, e.tile).r),
                Math.abs(a.q + a.r - tile(p, e.tile).q - tile(p, e.tile).r),
              ) -
                Math.max(
                  Math.abs(b.q - tile(p, e.tile).q),
                  Math.abs(b.r - tile(p, e.tile).r),
                  Math.abs(b.q + b.r - tile(p, e.tile).q - tile(p, e.tile).r),
                ) ||
              a.q - b.q ||
              a.r - b.r,
          );
        if (free[0]) r.tile = free[0].id;
        else delete n.core.entities[r.id];
      }
      delete n.core.entities[e.id];
      n.core.decision = null;
      if (population(p, n, active(n)) > support(p, n, active(n)))
        decision(p, n, "capacity", "", d.owner);
      else n.core.phase = "action";
    }
  } else if (c.type === "phase") {
    n.core.phase = "action";
    if (population(p, n, active(n)) > support(p, n, active(n))) {
      n.core.phase = "capacity";
      decision(p, n, "capacity", "", n.core.owners[active(n)]);
    }
  } else if (c.type === "pickup") {
    n.core.entities[c.resource].carrier = c.actor;
    n.core.entities[c.resource].tile = n.core.entities[c.actor].tile;
    n.core.ap--;
    emit(n, "resource.picked", {});
  } else if (c.type === "drop") {
    n.core.entities[c.resource].carrier = null;
    n.core.entities[c.resource].tile = c.to;
    n.core.ap--;
    emit(n, "resource.dropped", {});
  } else if (c.type === "end") {
    n.core.index = (n.core.index + 1) % n.core.slots.length;
    if (!n.core.index) {
      n.core.round++;
      n.core.effects = n.core.effects.filter((f) => f.expires > n.core.round);
      if (p.rules.floodEvery && (n.core.round - 1) % p.rules.floodEvery === 0) {
        runScheduledOperation(p.rules.systemOperation ?? "flood", {
          package: p,
          match: n,
          random: () => random(n),
          emit: (type, data) => {
            if (n.events.length - s.events.length >= 256)
              fail("Effect chain limit exceeded");
            emit(n, type, data);
          },
        });
      }
    }
    begin(p, n);
    n.undo = [];
    n.pending = null;
  }
  finish(p, n);
  n.revision++;
  n.inputs.push({ actor: who, command: copy(c) });
  return n;
}
export function replay(p: GamePackage, s: Match) {
  let n = create(
    p,
    s.packageDigest,
    s.initial.owners,
    s.initial.seed,
    s.network,
    s.initial.controllers,
  );
  n.id = s.id;
  for (const x of s.inputs)
    n = submit(p, n, x.actor, {
      matchId: n.id,
      revision: n.revision,
      command: x.command,
    });
  return n;
}
export function view(p: GamePackage, s: Match, who: string) {
  const d = s.core.decision;
  return {
    id: s.id,
    revision: s.revision,
    packageDigest: s.packageDigest,
    entities: copy(s.core.entities),
    owners: copy(s.core.owners),
    active: active(s),
    ap: s.core.ap,
    round: s.core.round,
    score: copy(s.core.score),
    phase: s.core.phase,
    areas: Object.fromEntries(
      s.core.slots.map((a) => [
        a,
        {
          population: population(p, s, a),
          support: support(p, s, a),
          clock: s.core.clocks[a] ?? 0,
        },
      ]),
    ),
    winner: s.core.winner,
    effects: copy(s.core.effects),
    decision: d
      ? {
          id: d.id,
          kind: d.kind,
          owner: d.owner,
          actor: d.actor,
          options:
            d.owner === who
              ? copy(d.options).map(({ id, label }) => ({ id, label }))
              : [],
        }
      : null,
    actions: actions(p, s, who),
    canUndo:
      !s.network &&
      !p.privateData &&
      !d &&
      s.undo.length > 0 &&
      decisionOwner(s) === who,
    privateData: p.privateData?.[who] ?? null,
    events: s.events
      .filter((e) => !e.audience || e.audience === who)
      .slice(-100),
  };
}
export function snapshot(p: GamePackage, s: Match) {
  return stable({ schema: 1, packageDigest: s.packageDigest, match: s });
}
export function restore(p: GamePackage, digest: string, text: string): Match {
  if (text.length > 5000000) fail("Save too large");
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    fail("Invalid JSON");
  }
  if (
    data?.schema !== 1 ||
    data.packageDigest !== digest ||
    data.match?.packageDigest !== digest
  )
    fail("Install the exact package version");
  const saved = data.match;
  const n = replay(p, saved);
  if (stable(n) !== stable(saved)) fail("Invalid save history/state");
  return n;
}
