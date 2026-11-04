import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { load, pack, digest } from "../packages/modkit/index.ts";
import { tile } from "../packages/engine/index.ts";
test("authority rejects forged/stale/duplicate commands and restores opposing pending decision after restart", async () => {
  const url = "http://127.0.0.1:5198/api/";
  let child: any;
  const data = ".runtime/network-test-" + process.pid + "-" + Date.now();
  const privatePackage=load("mods/swarm-basic-prototype/package.json");privatePackage.id="private-fixture";privatePackage.privateData={p1:"private-one",p2:"private-two"};mkdirSync(data+"/packages",{recursive:true});writeFileSync(data+"/packages/private.hexmod",pack(privatePackage));const launch = async () => {
    child = spawn(
      process.execPath,
      ["--import", "tsx", "packages/host/server.ts"],
      {
        env: { ...process.env, PORT: "5198", SWARM_HOST_DATA: data },
        stdio: "pipe",
      },
    );
    let logs = "";
    child.stderr.on("data", (b) => (logs += b));
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(url + "packages")).ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error("Host not ready " + logs);
  };
  const timings: number[] = [];
  const req = async (path: string, body: any, token?: string) => {
    const started = performance.now();
    const r = await fetch(url + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (path === "command" && r.ok) timings.push(performance.now() - started);
    return { ok: r.ok, data };
  };
  try {
    await launch();const privateMatch=await req("create",{digest:digest(privatePackage),owners:{A:"p1",E:"p2"},seed:7});assert(privateMatch.ok);const privateToken=privateMatch.data.seats.find(x=>x.player==="p1").token;const observation=JSON.stringify((await req("view",{id:privateMatch.data.id},privateToken)).data);assert(observation.includes("private-one"));assert(!observation.includes("private-two"));assert(!observation.includes("rng"));const catalogView=JSON.stringify(await (await fetch(url+"packages")).json());assert(!catalogView.includes("private-one"));assert(!catalogView.includes("private-two"));
    const p = load("mods/swarm-basic-prototype/package.json");
    p.id = "pending-fixture";
    p.name = "Pending fixture";
    p.rules.goal = 1;
    const q = p.setup.find((e) => e.id === "Eq")!,
      w = p.setup.find((e) => e.id === "Aw")!,
      near = tile(p, q.tile).edges.find(
        (t) => t && !p.setup.some((e) => e.tile === t),
      )!;
    w.tile = near;
    p.tiles.forEach((t) => (t.terrain = t.id === near ? "flower" : "ordinary"));
    assert(
      (
        await req("import", {
          archive: Buffer.from(pack(p)).toString("base64"),
        })
      ).ok,
    );
    const created = await req("create", {
      digest: digest(p),
      owners: { A: "p1", E: "p2" },
      seed: 4,
    });
    assert(created.ok);
    const { id, seats } = created.data;
    const a = seats.find((s) => s.player === "p1").token,
      b = seats.find((s) => s.player === "p2").token;
    assert(!(await req("view", { id }, "forged")).ok);
    let v = (await req("view", { id }, a)).data;
    const move = v.actions.find(
      (c) => c.type === "move" && c.actor === "Aw" && c.route[0] === q.tile,
    );
    assert(move);
    const command = {
      id,
      requestId: "move",
      revision: v.revision,
      command: move,
    };
    const accepted = await req("command", command, a);
    assert(accepted.ok);
    assert.deepEqual((await req("command", command, a)).data, accepted.data);
    assert(!(await req("command", { ...command, requestId: "stale" }, a)).ok);
    v = (await req("view", { id }, a)).data;
    assert.equal(v.decision.owner, "p2");
    assert.equal(v.decision.options.length, 0);
    assert(!("rng" in v));
    const before = (await req("view", { id }, b)).data;
    assert(before.decision.options.length);
    await new Promise<void>((r) => {
      child.once("exit", () => r());
      child.kill();
    });
    await launch();
    const after = (await req("view", { id }, b)).data;
    assert.deepEqual(after, before);
    const choice = after.actions.find((c) => c.option.startsWith("honey:"));
    assert(
      !(
        await req(
          "command",
          {
            id,
            requestId: "forged-choice",
            revision: after.revision,
            command: choice,
          },
          a,
        )
      ).ok,
    );
    assert(
      (
        await req(
          "command",
          {
            id,
            requestId: "produce",
            revision: after.revision,
            command: choice,
          },
          b,
        )
      ).ok,
    );
    v = (await req("view", { id }, a)).data;
    assert.equal(v.winner, null);
    assert.equal(v.decision.kind, "departure");
    assert(
      (
        await req(
          "command",
          {
            id,
            requestId: "depart",
            revision: v.revision,
            command: v.actions[0],
          },
          a,
        )
      ).ok,
    );
    assert.equal((await req("view", { id }, a)).data.winner, "p2");
    const botPackage = load("mods/swarm-basic-prototype/package.json");
    botPackage.id = "network-bot-fixture";
    botPackage.name = "Network bots";
    botPackage.rules.goal = 1;
    const ownQueen = botPackage.setup.find((e) => e.id === "Aq")!,
      worker = botPackage.setup.find((e) => e.id === "Aw")!;
    const flower = tile(botPackage, ownQueen.tile).edges.find(
      (t) => t && !botPackage.setup.some((e) => e.tile === t),
    )!;
    worker.tile = flower;
    botPackage.tiles.forEach(
      (t) => (t.terrain = t.id === flower ? "flower" : "ordinary"),
    );
    assert(
      (
        await req("import", {
          archive: Buffer.from(pack(botPackage)).toString("base64"),
        })
      ).ok,
    );
    const bots = await req("create", {
      digest: digest(botPackage),
      owners: { A: "p1", E: "p2" },
      seed: 8,
      bots: ["p1", "p2"],
    });
    assert(bots.ok);
    assert.equal(bots.data.seats.length, 2);
    const botSeat = bots.data.seats[0].token;
    let outcome = null;
    for (let i = 0; i < 50 && !outcome; i++) {
      await new Promise((r) => setTimeout(r, 100));
      outcome = (await req("view", { id: bots.data.id }, botSeat)).data.winner;
    }
    assert.equal(outcome, "p1");
  } finally {
    timings.sort((a, b) => a - b);
    mkdirSync(".runtime", { recursive: true });
    writeFileSync(
      ".runtime/network-metrics.json",
      JSON.stringify(
        {
          samples: timings.length,
          medianMs: timings[Math.floor(timings.length * 0.5)],
          p95Ms: timings[Math.floor(timings.length * 0.95)],
        },
        null,
        2,
      ),
    );
    if (child && !child.killed) child.kill();
  }
});
