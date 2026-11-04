import { test } from "node:test";
import assert from "node:assert/strict";
import {
  load,
  digest,
  validate,
  resolveDependencies,
} from "../packages/modkit/index.ts";
import {
  create,
  submit,
  actions,
  decisionOwner,
  copy,
  hash,
  support,
  view,
  restore,
  snapshot,
} from "../packages/engine/index.ts";
import { registerScheduledOperation } from "../packages/engine/extensions.ts";
const p = load("mods/swarm-basic-prototype/package.json");
const go = (p: any, s: any, c: any) =>
  submit(p, s, decisionOwner(s), {
    matchId: s.id,
    revision: s.revision,
    command: c,
  });
test("system participant owns shared Garden without a player controller or score", () => {
  const s = create(p, digest(p), { A: "p1", E: "p2" });
  assert.equal(s.core.participants.system.kind, "system");
  assert.equal(s.core.owners.G, "system");
  assert(!s.controllers.system);
  assert(!("system" in s.core.score));
});
test("controller configuration survives save and undo", () => {
  let s = create(p, digest(p), { A: "p1", E: "p2" }, 4, false, {
    p1: "human",
    p2: "bot",
  });
  s = go(
    p,
    s,
    actions(p, s, "p1").find((c) => c.type === "move"),
  );
  assert.equal(restore(p, digest(p), snapshot(p, s)).controllers.p2, "bot");
  s = go(p, s, { type: "undo" });
  assert.equal(s.controllers.p2, "bot");
});
test("shortage offers only initial pollen carriers before capacity removal", () => {
  const q = copy(p);
  q.setup.find((e) => e.id === "Ew")!.tile = q.tiles.find(
    (t) => t.terrain === "flower",
  )!.id;
  q.setup.find((e) => e.id === "Eh")!.tile = q.tiles.find(
    (t) => t.area === "A" && !q.setup.some((e) => e.tile === t.id),
  )!.id;
  let s = create(q, digest(q), { A: "p1", E: "p2" });
  s = go(q, s, { type: "end" });
  assert.equal(s.core.phase, "pollen");
  assert(actions(q, s, "p2").some((c) => c.type === "phase"));
  assert(
    actions(q, s, "p2").every((c) => c.type !== "move" || c.actor === "Ew"),
  );
  assert(!actions(q, s, "p2").some((c) => c.type === "pickup"));
  s = go(q, s, { type: "phase" });
  assert.equal(s.core.decision?.kind, "capacity");
});
test("trusted failing or over-budget effects leave source state untouched", () => {
  registerScheduledOperation("test-failure", ({ emit }) => {
    for (let i = 0; i < 300; i++) emit("test.event", {});
  });
  const q = copy(p);
  q.rules.floodEvery = 1;
  q.rules.systemOperation = "test-failure";
  assert.deepEqual(validate(q), []);
  let s = create(q, digest(q), { A: "p1", E: "p2" });
  s = go(q, s, { type: "end" });
  const before = hash(s);
  assert.throws(() => go(q, s, { type: "end" }), /limit/);
  assert.equal(hash(s), before);
});
test("private events and options are omitted for other seats", () => {
  const s = create(p, digest(p), { A: "p1", E: "p2" });
  s.events.push({
    seq: 999,
    revision: 0,
    transaction: 1,
    type: "private",
    data: { secret: "only-two" },
    audience: "p2",
  });
  assert(!JSON.stringify(view(p, s, "p1")).includes("only-two"));
  assert(JSON.stringify(view(p, s, "p2")).includes("only-two"));
});
test("package identifier injection and unknown operation rejected", () => {
  for (const modify of [
    (q: any) => (q.areas[0].id = "<img onerror=alert(1)>"),
    (q: any) => (q.rules.systemOperation = "unregistered-operation"),
  ]) {
    const q = copy(p);
    modify(q);
    assert(validate(q).length);
  }
});
test("pickup/drop consumes AP and support moves with carrier", () => {
  let s = create(p, digest(p), { A: "p1", E: "p2" });
  const e = s.core.entities.Aw,
    pot = s.core.entities.Ah;
  pot.tile = p.tiles.find(
    (t) =>
      t.area === "A" &&
      p.tiles.find((x) => x.id === e.tile)!.edges.includes(t.id) &&
      !Object.values(s.core.entities).some((x) => x.tile === t.id),
  )!.id;
  const start = copy(s.core);
  s = go(p, s, { type: "pickup", actor: e.id, resource: pot.id });
  assert.equal(s.core.ap, 5);
  assert.equal(s.core.entities.Ah.carrier, "Aw");
  s = go(p, s, { type: "undo" });
  assert.deepEqual(s.core, start);
});

test('capacity casualty releases carried pot onto its vacated cell',()=>{let s=create(p,digest(p),{A:'p1',E:'p2'});const source=p.tiles.find(t=>t.area==='G'&&t.terrain!=='flower')!.id;s.core.entities.Ew.tile=source;s.core.entities.Eh.carrier='Ew';s.core.entities.Eh.tile=source;s=go(p,s,{type:'end'});assert.equal(s.core.decision?.kind,'capacity');s=go(p,s,{type:'respond',decision:s.core.decision!.id,option:'Ew'});assert.equal(s.core.entities.Eh.carrier,null);assert.equal(s.core.entities.Eh.tile,source)});