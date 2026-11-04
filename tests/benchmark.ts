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
} from "../packages/engine/index.ts";
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
const report = {
  node: process.version,
  platform: platform(),
  cpu: cpus()[0].model,
  results,
  simulation: {
    decisions: result.decisions,
    winner: result.winner,
    elapsedMs: performance.now() - t,
  },
  archiveBytes: pack(p).length,
  memory: process.memoryUsage(),
};
mkdirSync(".runtime", { recursive: true });
writeFileSync(".runtime/benchmark.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
