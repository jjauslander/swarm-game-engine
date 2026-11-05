import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, platform } from "node:os";
import { load, digest, simulate, pack } from "../packages/modkit/index.ts";
import {
  create,
  actions,
  submit,
  decisionOwner,
  snapshot,
  restore,
} from "./swarm-runtime.ts";
const p = load("mods/swarm-basic-prototype/package.json"),
  results: any[] = [];
for (const owners of [
  { A: "p1", E: "p2" },
  { A: "p1", B: "p1", C: "p2", D: "p3", E: "p4", F: "p5" },
]) {
  let s = create(p, digest(p), owners as any),
    queries: number[] = [],
    commands: number[] = [];
  const commandTypes: Record<string, number> = {};
  for (let i = 0; i < 100 && !s.core.winner; i++) {
    let t = performance.now();
    const all = actions(p, s, decisionOwner(s));
    queries.push(performance.now() - t);
    const command =
      (i % 5 === 0
        ? all.find((c) => c.type === "end")
        : all.find((c) => c.type === "move")) ?? all[0];
    commandTypes[command.type] = (commandTypes[command.type] ?? 0) + 1;
    t = performance.now();
    s = submit(p, s, decisionOwner(s), {
      matchId: s.id,
      revision: s.revision,
      command,
    });
    commands.push(performance.now() - t);
  }
  const stats = (a: number[]) => {
    a.sort((a, b) => a - b);
    return {
      median: a[Math.floor(a.length * 0.5)],
      p95: a[Math.floor(a.length * 0.95)],
    };
  };
  let t = performance.now();
  const save = snapshot(p, s);
  restore(p, digest(p), save);
  results.push({
    owners,
    commandTypes,
    queryMs: stats(queries),
    commandMs: stats(commands),
    saveBytes: Buffer.byteLength(save),
    restoreMs: performance.now() - t,
  });
}
let t = performance.now();
const result = simulate(p, 500);
const mainSimulationMs = performance.now() - t;
const outpost = load("mods/outpost-capture/package.json");
const { runtime } = await import("../packages/composition/index.ts");
let os = runtime.create(outpost, digest(outpost), { A: "p1", B: "p2" }),
  queries: number[] = [],
  commands: number[] = [];
for (let i = 0; i < 100; i++) {
  if (os.outcome)
    os = runtime.create(outpost, digest(outpost), { A: "p1", B: "p2" });
  let begin = performance.now();
  runtime.actions(outpost, os, decisionOwner(os));
  queries.push(performance.now() - begin);
  const command = runtime.choose(outpost, os)!;
  begin = performance.now();
  os = runtime.submit(outpost, os, decisionOwner(os), {
    matchId: os.id,
    revision: os.revision,
    command,
  });
  commands.push(performance.now() - begin);
}
const stats = (a: number[]) => {
  a.sort((a, b) => a - b);
  return { median: a[50], p95: a[95] };
};
const saved = runtime.snapshot(outpost, os);
t = performance.now();
runtime.restore(outpost, digest(outpost), saved);
results.push({
  game: outpost.id,
  operations: 100,
  queryMs: stats(queries),
  commandMs: stats(commands),
  restoreMs: performance.now() - t,
  saveBytes: Buffer.byteLength(saved),
});
for (const result of results)
  if (result.queryMs.p95 >= 20 || result.commandMs.p95 >= 20)
    throw Error("20ms p95 acceptance target failed");
const report = {
  node: process.version,
  platform: platform(),
  cpu: cpus()[0].model,
  results,
  simulation: {
    decisions: result.decisions,
    winner: result.winner,
    elapsedMs: mainSimulationMs,
  },
  archiveBytes: pack(p).length,
  memory: process.memoryUsage(),
};
mkdirSync(".runtime", { recursive: true });
writeFileSync(".runtime/benchmark.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
