import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Runtime,
  copy,
  stable,
  decisionOwner,
  emit,
  random,
  id,
} from "../packages/engine/index.ts";
import {
  outpostModule,
  type OutpostPackage,
  type OutpostState,
} from "../games/outpost-capture/module.ts";
import { load, digest, simulate, pack } from "../packages/modkit/index.ts";
import { unpack } from "../packages/engine/package.ts";
import { sourceDigest } from "../scripts/module-identities.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
const p = load("mods/outpost-capture/package.json") as OutpostPackage;
const runtime = new Runtime().register(outpostModule);
const start = (q = p) =>
  runtime.create<OutpostPackage, OutpostState>(q, digest(q), {
    A: "p1",
    B: "p2",
  });
const go = (
  s: ReturnType<typeof start>,
  c: any,
  q = p,
  who = decisionOwner(s),
) =>
  runtime.submit(q, s, who, {
    matchId: s.id,
    revision: s.revision,
    command: c,
  });
const cell = (q: number, r: number) =>
  p.tiles.find((t) => t.q === q && t.r === r)!.id;
test("Outpost setup has 19 independent cells, direct owners, fuel income and no Swarm state", () => {
  const s = start();
  assert.equal(p.tiles.length, 19);
  assert.equal(s.core.fuel.p1, 5);
  assert.equal(s.core.fuel.p2, 3);
  assert.equal(s.core.ap, 3);
  assert.equal(s.core.entities.scoutA.owner, "p1");
  for (const k of ["pollen", "queen", "cargo", "support", "flower"])
    assert(!JSON.stringify(s).includes(k));
  assert.throws(() => runtime.create(p, digest(p), { A: "p1", B: "p1" }));
  assert.throws(() =>
    runtime.create(p, digest(p), { A: "p1", B: "p2", X: "p3" }),
  );
});
test("Outpost move costs, blocked paths, fuel cap, query purity, whole action Undo", () => {
  let s = start();
  const before = copy(s);
  runtime.actions(p, s, "p1");
  runtime.view(p, s, "p1");
  runtime.choose(p, s);
  assert.deepEqual(s, before);
  s = go(s, { type: "move", actor: "scoutA", route: [cell(0, 0)] });
  assert.equal(s.core.ap, 2);
  assert.equal(s.core.fuel.p1, 4);
  assert.throws(() =>
    go(s, { type: "move", actor: "scoutA", route: [cell(1, 0)] }),
  );
  s = go(s, { type: "undo" });
  assert.deepEqual(s.core, before.core);
  assert.equal(s.rng, before.rng);
  assert.equal(s.allocator, before.allocator);
  s.core.fuel.p1 = 0;
  assert(!runtime.actions(p, s, "p1").some((a) => a.type === "move"));
  s = go(s, { type: "end" });
  assert.equal(s.core.fuel.p2, 5);
  s = go(s, { type: "end" });
  assert.equal(s.core.fuel.p1, 2);
  s.core.fuel.p1 = 6;
  s = go(go(s, { type: "end" }), { type: "end" });
  assert.equal(s.core.fuel.p1, 6);
});
test("Outpost deployment checks occupancy, limits, AP and Fuel", () => {
  let s = start();
  s = go(s, { type: "deploy" });
  assert.equal(s.core.ap, 1);
  assert.equal(s.core.fuel.p1, 2);
  assert.equal(Object.keys(s.core.entities).length, 3);
  const deployed = Object.values(s.core.entities).find(
    (e) => e.id !== "scoutA" && e.owner === "p1",
  )!;
  assert.equal(deployed.tile, p.bases.A);
  s.core.ap = 3;
  s.core.fuel.p1 = 6;
  assert(!runtime.actions(p, s, "p1").some((a) => a.type === "deploy"));
  deployed.tile = cell(-1, 1);
  s.core.entities.extra = { id: "extra", owner: "p1", tile: cell(0, 1) };
  assert(!runtime.actions(p, s, "p1").some((a) => a.type === "deploy"));
  delete s.core.entities.extra;
  s.core.fuel.p1 = 2;
  assert(!runtime.actions(p, s, "p1").some((a) => a.type === "deploy"));
  s.core.fuel.p1 = 3;
  s.core.ap = 1;
  assert(!runtime.actions(p, s, "p1").some((a) => a.type === "deploy"));
});
test("Outpost explicit claim, no entry victory, final-round priority and draw lockout", () => {
  let s = start();
  assert.throws(() => go(s, { type: "claim", actor: "scoutA" }));
  s.core.entities.scoutA.tile = cell(2, -1);
  s = go(s, { type: "move", actor: "scoutA", route: [p.bases.B] });
  assert.equal(s.outcome, null);
  s.core.round = 30;
  s.core.fuel.p1 = 0;
  const before = copy(s);
  s = go(s, { type: "claim", actor: "scoutA" });
  assert.deepEqual(s.outcome, { winners: ["p1"], reason: "base-claimed" });
  assert.equal(s.core.ap, 1);
  assert.equal(s.core.fuel.p1, 0);
  assert.deepEqual(runtime.actions(p, s, "p1"), []);
  assert.throws(() => go(s, { type: "end" }));
  s = go(s, { type: "undo" });
  assert.deepEqual(s.core, before.core);
  s = start();
  for (let i = 0; i < 60; i++) s = go(s, { type: "end" });
  assert.deepEqual(s.outcome, { winners: [], reason: "round-limit" });
  assert.equal(s.core.round, 30);
  assert.throws(() => go(s, { type: "end" }));
  s = start();
  s = go(s, { type: "end" });
  s.core.round = 30;
  s.core.entities.scoutB.tile = p.bases.A;
  s = go(s, { type: "claim", actor: "scoutB" });
  assert.deepEqual(s.outcome?.winners, ["p2"]);
});
test("Outpost seeded completion and cross-process replay preserve exact state", () => {
  const a = simulate(p, 100),
    b = simulate(p, 100);
  assert.equal(a.winner, "p1");
  assert.equal(a.decisions, 10);
  assert.deepEqual(a, b);
  const save = runtime.snapshot(p, a.match);
  assert.deepEqual(runtime.restore(p, digest(p), save), a.match);
  mkdirSync(".runtime", { recursive: true });
  const file = ".runtime/outpost-replay-" + process.pid + ".json";
  writeFileSync(file, save);
  const script =
    "import {readFileSync} from 'node:fs';import {Runtime,stable} from './packages/engine/index.ts';import {outpostModule} from './games/outpost-capture/module.ts';const p=JSON.parse(readFileSync('mods/outpost-capture/package.json','utf8'));const save=readFileSync(" +
    JSON.stringify(file) +
    ",'utf8');const r=new Runtime().register(outpostModule);console.log(stable(r.restore(p,JSON.parse(save).packageDigest,save)));";
  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), stable(a.match));
});
test("module identity, missing registration, malformed state and old saves fail safely", () => {
  const s = start(),
    save = runtime.snapshot(p, s),
    before = stable(s);
  assert.throws(
    () => new Runtime().create(p, digest(p), { A: "p1", B: "p2" }),
    /exact trusted module/,
  );
  assert.throws(() => runtime.register(outpostModule), /Duplicate/);
  const changed = copy(p);
  changed.module.digest = "f".repeat(64);
  assert.throws(() => runtime.restore(changed, digest(changed), save), /exact/);
  assert.throws(
    () => runtime.restore(p, digest(p), JSON.stringify({ schema: 1 })),
    /2c6d11c/,
  );
  const corrupt = JSON.parse(save);
  corrupt.match.core.ap = -1;
  assert.throws(() => runtime.restore(p, digest(p), JSON.stringify(corrupt)));
  assert.throws(() => outpostModule.validateState(p, { ...s.core, ap: -1 }));
  assert.throws(() => go(s, { type: "mystery" }));
  assert.throws(() =>
    go(s, { type: "respond", decision: "fake", option: "fake" }),
  );
  assert.equal(stable(s), before);
  const q = copy(p);
  q.rules.fuelCap = -1;
  assert(runtime.validate(q).length);
  assert.throws(
    () => unpack(pack(p), (x) => new Runtime().validate(x)),
    /exact trusted module/,
  );
});
test("module queries and failing draft effects cannot change authority or leak exception secrets", () => {
  const evil = {
    ...outpostModule,
    actions(q, s, who) {
      q.rules.ap = 99;
      s.core.fuel.p1 = 99;
      return [{ type: "fault" }];
    },
    apply(q, s) {
      random(s);
      id(s);
      s.core.ap--;
      emit(s, "partial", {});
      throw Error("opponent-private-secret");
    },
  };
  const isolated = new Runtime().register(evil);
  const s = isolated.create<OutpostPackage, OutpostState>(p, digest(p), {
    A: "p1",
    B: "p2",
  });
  const before = stable(s),
    definition = stable(p);
  assert.deepEqual(isolated.actions(p, s, "p1"), [{ type: "fault" }]);
  assert.equal(stable(s), before);
  assert.equal(stable(p), definition);
  assert.throws(
    () =>
      isolated.submit(p, s, "p1", {
        matchId: s.id,
        revision: 0,
        command: { type: "fault" },
      }),
    (e) =>
      !String(e).includes("private-secret") &&
      String(e).includes("state unchanged"),
  );
  assert.equal(stable(s), before);
});
test("source identity is reproducible and transitive changes invalidate unchanged version", () => {
  assert.equal(
    sourceDigest("games/outpost-capture/module.ts"),
    p.module.digest,
  );
  const dir = ".runtime/identity-test-" + process.pid;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    dir + "/entry.ts",
    'import {value} from "./rule.ts";export const result=value;',
  );
  writeFileSync(dir + "/rule.ts", "export const value=1;");
  const first = sourceDigest(dir + "/entry.ts");
  writeFileSync(dir + "/rule.ts", "export const value=2;");
  assert.notEqual(sourceDigest(dir + "/entry.ts"), first);
});
test("Outpost bundles and plays to completion without Swarm implementation in its graph", async () => {
  const dir = ".runtime/outpost-only-" + process.pid;
  mkdirSync(dir, { recursive: true });
  const entry = dir + "/entry.ts";
  writeFileSync(
    entry,
    "import {Runtime,decisionOwner} from '../../packages/engine/index.ts';import {outpostModule} from '../../games/outpost-capture/module.ts';import p from '../../mods/outpost-capture/package.json';const r=new Runtime().register(outpostModule);let s=r.create(p,'standalone',{A:'p1',B:'p2'});for(let i=0;i<100&&!s.outcome;i++)s=r.submit(p,s,decisionOwner(s),{matchId:s.id,revision:s.revision,command:r.choose(p,s)});console.log(JSON.stringify(s.outcome));",
  );
  const out = await build({
    entryPoints: [entry],
    outfile: dir + "/play.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    metafile: true,
  });
  assert(
    !Object.keys(out.metafile!.inputs).some((x) =>
      x.includes("games/swarm-basic"),
    ),
  );
  const child = spawnSync(process.execPath, [dir + "/play.cjs"], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {
    winners: ["p1"],
    reason: "base-claimed",
  });
});
