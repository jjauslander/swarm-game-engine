import { test } from "node:test";
import assert from "node:assert/strict";
import {
  load,
  digest,
  validate,
  pack,
  unpack,
  simulate,
} from "../packages/modkit/index.ts";
import {
  create,
  submit,
  actions,
  decisionOwner,
  hash,
  copy,
  replay,
  snapshot,
  restore,
  routes,
  tile,
  support,
  population,
  view,
} from "./swarm-runtime.ts";
import { zipSync, strToU8 } from "fflate";
const base = load("mods/swarm-basic-prototype/package.json");
const start = (
  p = base,
  owners: Record<string, string> = { A: "p1", E: "p2" },
) => create(p, digest(p), owners);
const go = (p: any, s: any, c: any, who = decisionOwner(s)) =>
  submit(p, s, who, { matchId: s.id, revision: s.revision, command: c });
function delivery() {
  const p = copy(base);
  const q = p.setup.find((e) => e.id === "Eq")!,
    w = p.setup.find((e) => e.id === "Aw")!;
  const dest = tile(p, q.tile).edges.find(
    (t) => t && !p.setup.some((e) => e.tile === t),
  )!;
  w.tile = dest; // pollen set after create through replayable Flower fixture below
  const s = start(p);
  s.core.entities.Aw.pollen = 1;
  return { p, s, q, w };
}
test("reference board has 259 tiles and stable directional reciprocal topology", () => {
  assert.equal(base.tiles.length, 259);
  assert.deepEqual(validate(base), []);
  for (const t of base.tiles)
    for (let d = 0; d < 6; d++)
      if (t.edges[d])
        assert.equal(tile(base, t.edges[d]!).edges[(d + 3) % 6], t.id);
});
test("unused areas excluded from legal actions", () => {
  const s = start();
  assert(!s.core.entities.Bq);
  assert(
    actions(base, s, "p1").every(
      (c) =>
        c.type !== "move" ||
        c.route.every((t) => ["A", "E", "G"].includes(tile(base, t).area)),
    ),
  );
});
test("separate area clocks and AP for same owner", () => {
  let s = start(base, { A: "p1", B: "p1", E: "p2" });
  s = go(base, s, { type: "end" });
  assert.equal(s.core.slots[s.core.index], "B");
  assert.equal(s.core.ap, 6);
  assert.equal(s.core.clocks.A, 1);
  assert.equal(s.core.clocks.B, 1);
});
test("reject stale, forged actor, illegal command without mutation/RNG consumption", () => {
  const s = start(),
    before = hash(s);
  assert.throws(() =>
    submit(base, s, "p2", {
      matchId: s.id,
      revision: 0,
      command: { type: "end" },
    }),
  );
  assert.throws(() =>
    submit(base, s, "p1", {
      matchId: s.id,
      revision: 9,
      command: { type: "end" },
    }),
  );
  assert.throws(() =>
    go(base, s, { type: "move", actor: "Aw", route: ["missing"] }),
  );
  assert.equal(hash(s), before);
});
test("replay and exact save restoration include RNG and allocator", () => {
  const p = load("mods/garden-cycle/package.json");
  let s = start(p);
  for (let i = 0; i < 8; i++) s = go(p, s, { type: "end" });
  assert.deepEqual(replay(p, s), s);
  assert.deepEqual(restore(p, digest(p), snapshot(p, s)), s);
});
test("corrupt saves and package mismatches fail", () => {
  const s = start();
  assert.throws(() => restore(base, "wrong", snapshot(base, s)));
  const d = JSON.parse(snapshot(base, s));
  d.match.core.ap = 900;
  assert.throws(() => restore(base, digest(base), JSON.stringify(d)));
  assert.throws(() => restore(base, digest(base), "no"));
});
test("network match identity restores exactly", () => {
  let s = start();
  s.id = "network-opaque";
  s = go(base, s, { type: "end" });
  assert.deepEqual(restore(base, digest(base), snapshot(base, s)), s);
});
test("opposing Queen decides, donor owns departure, complete action undo", () => {
  let { p, s, q } = delivery();
  const before = copy(s.core);
  s = go(p, s, { type: "move", actor: "Aw", route: [q.tile] });
  assert.equal(s.core.decision?.owner, "p2");
  assert.equal(s.core.decision?.kind, "production");
  const rev = s.revision;
  const choice = s.core.decision!.options.find((x) =>
    x.id.startsWith("honey:"),
  )!;
  s = go(p, s, {
    type: "respond",
    decision: s.core.decision!.id,
    option: choice.id,
  });
  assert.equal(s.revision, rev + 1);
  assert.equal(s.core.decision?.owner, "p1");
  assert.equal(s.core.decision?.kind, "departure");
  assert.equal(s.core.score.p2, 1);
  s = go(p, s, actions(p, s, "p1")[0]);
  assert.equal(s.undo.length, 1);
  s = go(p, s, { type: "undo" });
  assert.deepEqual(s.core, before);
});
test("no premature victory before compulsory free departure at zero AP", () => {
  let { p, s, q } = delivery();
  p.rules.goal = 1;
  s.core.ap = 1;
  s = go(p, s, { type: "move", actor: "Aw", route: [q.tile] });
  s = go(
    p,
    s,
    actions(p, s, "p2").find((c) => c.option.startsWith("honey:")),
  );
  assert.equal(s.core.winner, null);
  assert.equal(s.core.ap, 0);
  s = go(p, s, actions(p, s, "p1")[0]);
  assert.equal(s.core.winner, "p2");
  assert.equal(s.core.ap, 0);
});
test("network undo rejected at authority", () => {
  let s = start();
  s.network = true;
  s = go(
    base,
    s,
    actions(base, s, "p1").find((c) => c.type === "move"),
  );
  assert.throws(() => go(base, s, { type: "undo" }));
});
test("private observations never expose another seat private data or RNG", () => {
  const p = copy(base);
  p.privateData = { p1: "secret-one", p2: "secret-two" };
  const s = start(p);
  const a = JSON.stringify(view(p, s, "p1"));
  assert(a.includes("secret-one"));
  assert(!a.includes("secret-two"));
  assert(!a.includes('"rng"'));
  assert(!a.includes('"inputs"'));
  assert.equal(view(p, s, "p1").canUndo, false);
});
test("carried support follows physical territory independently of origin", () => {
  const s = start();
  const pot = s.core.entities.Ah;
  pot.carrier = "Aw";
  s.core.entities.Aw.tile = s.core.entities.Ew.tile;
  assert.equal(support(base, s, "A"), 0);
  assert.equal(support(base, s, "E"), 6);
  assert.equal(population(base, s, "A"), 2);
});
test("Queen cannot move outside origin territory", () => {
  const s = start();
  s.core.entities.Aq.tile = base.tiles.find(
    (t) =>
      t.area === "A" && t.edges.some((e) => e && tile(base, e).area === "G"),
  )!.id;
  assert(
    routes(base, s, "Aq").every((r) =>
      r.every((t) => tile(base, t).area === "A"),
    ),
  );
});
test("Bumblebee one/two segment cost one AP and undo is atomic", () => {
  let s = start();
  const c = actions(base, s, "p1").find(
    (c) => c.type === "move" && c.actor === "Ab" && c.route.length === 2,
  );
  assert(c);
  const before = copy(s.core);
  s = go(base, s, c);
  assert.equal(s.core.ap, 5);
  s = go(base, s, { type: "undo" });
  assert.deepEqual(s.core, before);
});
test("occupied Flower entrant collects then exits free for one AP", () => {
  const p = copy(base),
    f = p.tiles.find((t) => t.terrain === "flower")!,
    near = f.edges[0]!;
  const s = start(p);
  s.core.entities.Aw.tile = near;
  s.core.entities.Ew.tile = f.id;
  s.core.ap = 1;
  const c = actions(p, s, "p1").find(
    (c) => c.type === "move" && c.actor === "Aw" && c.route[0] === f.id,
  );
  assert(c);
  const n = go(p, s, c);
  assert.equal(n.core.ap, 0);
  assert.equal(n.core.entities.Aw.pollen, 1);
  assert.notEqual(n.core.entities.Aw.tile, f.id);
  assert.equal(n.core.entities.Ew.tile, f.id);
});
test("capacity decision removes only support-counted active-hive individuals", () => {
  let s = start();
  s.core.entities.Eh.tile = s.core.entities.Ah.tile;
  s = go(base, s, { type: "end" });
  assert.equal(s.core.decision?.kind, "capacity");
  while (s.core.decision) s = go(base, s, actions(base, s, "p2")[0]);
  assert.equal(population(base, s, "E"), 0);
  assert(s.core.entities.Eq);
});
test("flood scheduled every third round, blocks landing and expires", () => {
  const p = load("mods/garden-cycle/package.json");
  let s = start(p);
  for (let i = 0; i < 6; i++) s = go(p, s, { type: "end" });
  assert.equal(s.core.round, 4);
  assert.equal(s.core.effects.length, 1);
  const flooded = s.core.effects[0].tile;
  assert(
    actions(p, s, "p1").every(
      (c) => c.type !== "move" || !c.route.includes(flooded),
    ),
  );
  for (let i = 0; i < 2; i++) s = go(p, s, { type: "end" });
  assert.equal(s.core.effects.length, 0);
});
test("both packages complete a deterministic bot match", () => {
  for (const path of ["swarm-basic-prototype", "garden-cycle"]) {
    const p = load("mods/" + path + "/package.json"),
      a = simulate(p, 500),
      b = simulate(p, 500);
    assert(a.winner);
    assert.equal(hash(a.match), hash(b.match));
  }
});
test("package roundtrip stable and malformed schemas rejected", () => {
  assert.equal(digest(unpack(pack(base))), digest(base));
  for (const mutate of [
    (p: any) => p.tiles.push(p.tiles[0]),
    (p: any) => p.capabilities.push("eval"),
    (p: any) => (p.rules.ap = -1),
    (p: any) => (p.script = "evil"),
  ]) {
    const p = copy(base);
    mutate(p);
    assert(validate(p).length);
    assert.throws(() => pack(p));
  }
});
test("archive traversal and decompression size rejected", () => {
  assert.throws(() => unpack(zipSync({ "../evil": strToU8("x") })));
  assert.throws(() =>
    unpack(zipSync({ "package.json": new Uint8Array(5000001) })),
  );
});
test("small topology runs without global board assumptions", () => {
  const p = copy(base);
  p.tiles = p.tiles.filter((t) => t.area === "A" || t.area === "E");
  const ids = new Set(p.tiles.map((t) => t.id));
  p.tiles.forEach(
    (t) => (t.edges = t.edges.map((x) => (x && ids.has(x) ? x : null))),
  );
  p.setup = p.setup.filter((e) => ids.has(e.tile));
  p.rules.floodTiles = [];
  assert.deepEqual(validate(p), []);
  assert.equal(start(p).core.slots.length, 2);
  assert(actions(p, start(p), "p1").length > 1);
});
