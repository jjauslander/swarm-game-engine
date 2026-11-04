import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import {
  Workspace,
  catalog,
  resolveDependencies,
  pack,
  unpack,
  digest,
} from "../packages/modkit/index.ts";
test("workspace confines paths and refuses overwrite", () => {
  const root = ".runtime/test-workspace-" + process.pid + "-" + Date.now();
  const w = new Workspace(root),
    p = catalog()[0];
  assert.throws(() => w.create("../outside", p));
  w.create("demo", p);
  assert.throws(() => w.create("demo", p));
  assert.equal(w.read("demo").id, "demo");
});
test("missing dependencies fail precisely", () => {
  const p = structuredClone(catalog()[0]);
  p.dependencies = [
    { id: "missing", version: "1.0.0", digest: "a".repeat(64) },
  ];
  assert.throws(() => resolveDependencies(p, []), /Missing exact dependency/);
});
test("real MCP stdio creates edits validates simulates and packs variant", async () => {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "packages/mcp/main.ts"],
    {
      env: {
        ...process.env,
        SWARM_MOD_WORKSPACE:
          ".runtime/mcp-test-" + process.pid + "-" + Date.now(),
      },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  let buf = "",
    counter = 0;
  let previewStarted = false;
  const pending = new Map<number, any>();
  child.stdout.on("data", (b) => {
    buf += b;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      const r = JSON.parse(line);
      pending.get(r.id)?.(r);
      pending.delete(r.id);
    }
  });
  const rpc = (method: string, params: any = {}) =>
    new Promise<any>((resolve, reject) => {
      const id = ++counter;
      const timeout = setTimeout(() => reject(Error("MCP timeout")), 10000);
      pending.set(id, (r: any) => {
        clearTimeout(timeout);
        resolve(r.result);
      });
      child.stdin.write(
        JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n",
      );
    });
  const tool = async (name: string, args: any = {}) => {
    const r = await rpc("tools/call", { name, arguments: args });
    assert(!r.isError, r.content?.[0]?.text);
    return JSON.parse(r.content[0].text);
  };
  try {
    assert(
      (await rpc("initialize", { protocolVersion: "2024-11-05" })).capabilities
        .tools,
    );
    assert((await rpc("tools/list")).tools.length >= 8);
    await tool("create_mod", {
      name: "test-variant",
      template: "garden-cycle",
    });
    const p = await tool("read_mod", { name: "test-variant" });
    p.rules.floodEvery = 2;
    await tool("write_mod", { name: "test-variant", package: p });
    assert.deepEqual(
      (await tool("validate_mod", { name: "test-variant" })).errors,
      [],
    );
    assert(
      (await tool("simulate_mod", { name: "test-variant", limit: 100 }))
        .decisions > 0,
    );
    const packed = await tool("pack_mod", { name: "test-variant" });
    assert.equal(
      unpack(Buffer.from(packed.archive, "base64")).rules.floodEvery,
      2,
    );
    const preview = await tool("preview_mod", { name: "test-variant" });
    previewStarted = preview.startedHost;
    const html = await fetch(preview.url);
    assert(html.ok);
    assert((await html.text()).includes("Swarm Game Engine"));
    const installed = await (
      await fetch("http://127.0.0.1:5174/api/packages")
    ).json();
    assert(installed.some((x) => x.package.id === "test-variant"));
  } finally {
    if (previewStarted) {
      const data = JSON.parse(
        readFileSync(".runtime/preview-process.json", "utf8"),
      );
      process.kill(data.pid);
    }
    child.kill();
  }
});
