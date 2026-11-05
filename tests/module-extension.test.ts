import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import {
  Runtime,
  copy,
  stable,
  decisionOwner,
  emit,
} from "../packages/engine/index.ts";
import {
  createRelayModule,
  type RelayPackage,
  type RelayState,
} from "../templates/signal-relay/module.ts";
import { sourceDigest } from "../scripts/module-identities.ts";
const p = JSON.parse(
  readFileSync("templates/signal-relay/game.json", "utf8"),
) as RelayPackage;
p.module.digest = sourceDigest("templates/signal-relay/module.ts");
const m = createRelayModule(p.module),
  r = new Runtime().register(m);
const start = () =>
  r.create<RelayPackage, RelayState>(p, "relay-package", { A: "p1", B: "p2" });
const go = (s: ReturnType<typeof start>, c: any, who = decisionOwner(s)) =>
  r.submit(p, s, who, { matchId: s.id, revision: s.revision, command: c });
test("independent source module adds novel actions/resource/opposing choice without common implementation edits", () => {
  const baseline = JSON.parse(
    readFileSync("docs/verification/module-boundary-baseline.json", "utf8"),
  );
  for (const [path, digest] of Object.entries(baseline))
    assert.equal(
      createHash("sha256")
        .update(readFileSync(path, "utf8").replaceAll("\r\n", "\n"))
        .digest("hex"),
      digest,
      "Common implementation changed since extension proof: " + path,
    );
  let s = start();
  const before = copy(s);
  s = go(s, { type: "transmit" });
  assert.equal(s.core.charge.p1, 1);
  assert.equal(s.turn, "p1");
  assert.equal(decisionOwner(s), "p2");
  assert.equal(s.decision?.kind, "signal-response");
  assert.equal(s.outcome, null);
  assert.equal(r.view(p, s, "p1").decision?.options.length, 0);
  assert(!JSON.stringify(r.view(p, s, "p1")).includes("nonce"));
  assert(JSON.stringify(r.view(p, s, "p2")).includes("nonce"));
  assert.throws(() =>
    go(
      s,
      { type: "respond", decision: s.decision!.id, option: "accept" },
      "p1",
    ),
  );
  const save = r.snapshot(p, s);
  const restored = r.restore<RelayPackage, RelayState>(
    p,
    "relay-package",
    save,
  );
  assert.deepEqual(restored, s);
  s = go(restored, {
    type: "respond",
    decision: s.decision!.id,
    option: "accept",
  });
  assert.deepEqual(s.outcome, { winners: ["p2"], reason: "relay-charged" });
  assert.equal(s.undo.length, 1);
  s = go(s, { type: "undo" });
  assert.deepEqual(s.core, before.core);
  assert.equal(s.rng, before.rng);
  assert.equal(s.allocator, before.allocator);
});
test("independent continuation validates and resumes in a fresh process", () => {
  const s = go(start(), { type: "transmit" }),
    save = r.snapshot(p, s),
    dir = ".runtime/relay-" + process.pid;
  mkdirSync(dir, { recursive: true });
  writeFileSync(dir + "/save.json", save);
  writeFileSync(dir + "/package.json", stable(p));
  const script =
    "import {readFileSync} from 'node:fs';import {Runtime} from './packages/engine/index.ts';import {createRelayModule} from './templates/signal-relay/module.ts';const p=JSON.parse(readFileSync(" +
    JSON.stringify(dir + "/package.json") +
    ",'utf8'));const r=new Runtime().register(createRelayModule(p.module));let s=r.restore(p,'relay-package',readFileSync(" +
    JSON.stringify(dir + "/save.json") +
    ",'utf8'));s=r.submit(p,s,'p2',{matchId:s.id,revision:s.revision,command:s.decision.options[0].command});console.log(JSON.stringify(s.outcome));";
  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {
    winners: ["p2"],
    reason: "relay-charged",
  });
  const corrupted = copy(s.core);
  corrupted.choice!.kind = "unknown";
  assert.throws(() => m.validateState(p, corrupted));
});
test("runtime bounds effect chains, blocks invalid hook state and honours irreversible policy", () => {
  for (const faulty of [
    {
      ...m,
      apply(p, s, c) {
        for (let i = 0; i < 300; i++) emit(s, "repeat", {});
      },
    },
    {
      ...m,
      apply(p, s, c) {
        s.core.charge.p1 = -1;
      },
    },
  ]) {
    const runtime = new Runtime().register(faulty),
      s = runtime.create(p, "relay", { A: "p1", B: "p2" }),
      before = stable(s);
    assert.throws(() =>
      runtime.submit(p, s, "p1", {
        matchId: s.id,
        revision: 0,
        command: { type: "transmit" },
      }),
    );
    assert.equal(stable(s), before);
  }
  const runtime = new Runtime().register({ ...m, undoAllowed: () => false });
  let s = runtime.create(p, "relay", { A: "p1", B: "p2" });
  s = runtime.submit(p, s, "p1", {
    matchId: s.id,
    revision: 0,
    command: { type: "recharge" },
  });
  assert.equal(s.undo.length, 0);
  assert.throws(() =>
    runtime.submit(p, s, "p2", {
      matchId: s.id,
      revision: s.revision,
      command: { type: "undo" },
    }),
  );
});
test("module policy receives permitted observation and no private package values", () => {
  const privateP = copy(p);
  privateP.privateData = { p1: "one-only", p2: "two-only" };
  const runtime = new Runtime().register({
    ...m,
    policy(def, observation) {
      assert(!("privateData" in def));
      assert(!JSON.stringify(observation).includes("two-only"));
      return observation.actions[0];
    },
  });
  const s = runtime.create(privateP, "private", { A: "p1", B: "p2" });
  assert(runtime.choose(privateP, s));
});

test("copied source starter builds and runs without changing engine/client/host", async () => {
  const dir = ".runtime/source-starter-" + process.pid;
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    dir + "/module.ts",
    readFileSync("templates/signal-relay/module.ts"),
  );
  const definition = copy(p);
  definition.id = "my-new-game";
  definition.module.id = "my-new-game";
  definition.module.digest = sourceDigest(dir + "/module.ts");
  writeFileSync(dir + "/game.json", stable(definition));
  writeFileSync(
    dir + "/entry.ts",
    "import {Runtime,decisionOwner} from '../../packages/engine/index.ts';import {createRelayModule} from './module.ts';import p from './game.json';const r=new Runtime().register(createRelayModule(p.module));let s=r.create(p,'starter',{A:'p1',B:'p2'});s=r.submit(p,s,'p1',{matchId:s.id,revision:0,command:{type:'transmit'}});s=r.restore(p,'starter',r.snapshot(p,s));s=r.submit(p,s,'p2',{matchId:s.id,revision:s.revision,command:s.decision.options[0].command});console.log(JSON.stringify(s.outcome));",
  );
  await build({
    entryPoints: [dir + "/entry.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: dir + "/play.cjs",
  });
  const child = spawnSync(process.execPath, [dir + "/play.cjs"], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {
    winners: ["p2"],
    reason: "relay-charged",
  });
});
