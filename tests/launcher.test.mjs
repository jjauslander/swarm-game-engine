import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  readFileSync,
  mkdtempSync,
  cpSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import net from "node:net";
import http from "node:http";
import { parseOptions, fingerprint } from "../scripts/play.mjs";

let fixture;
function run(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/play.mjs", ...args], {
      cwd: fixture,
      env: {
        ...process.env,
        SWARM_HOST_DATA: ".runtime/launcher-test-host",
        ...env,
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (b) => (output += b));
    child.stderr.on("data", (b) => (output += b));
    child.on("error", reject);
    const timeout = setTimeout(() => {
      child.kill();
      reject(Error("Launcher timed out: " + output));
    }, 120000);
    child.on("exit", (code) => {
      clearTimeout(timeout);
      resolve({ code, output });
    });
  });
}
async function availablePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}
test("launcher validates options and identifies cloud without inventing a preview URL", () => {
  assert.equal(parseOptions([], {}).port, null);
  assert.equal(
    parseOptions([], { CLAUDE_CODE_REMOTE_SESSION_ID: "session" }).cloud,
    true,
  );
  assert.equal(
    parseOptions(["--cloud", "--background", "--port", "5200"], {}).port,
    5200,
  );
  assert.throws(() => parseOptions(["--port", "bad"], {}), /port/);
  assert.throws(() => parseOptions(["--port", "22"], {}), /port/);
  assert.throws(() => parseOptions(["--unknown"], {}), /Unknown/);
});
test("one command installs/builds/serves, reuses its server, supports cloud and leaves unrelated ports alone", async () => {
  fixture = mkdtempSync(join(tmpdir(), "swarm-launcher-"));
  const excluded = new Set([
    ".git",
    "node_modules",
    "dist",
    ".runtime",
    "test-results",
    "playwright-report",
  ]);
  cpSync(process.cwd(), fixture, {
    recursive: true,
    filter: (src) => !excluded.has(basename(src)),
  });
  const port = await availablePort();
  let ownedPid;
  try {
    const first = await run(["--background", "--port", String(port)], {
      CLAUDE_CODE_REMOTE: "",
      CLAUDE_CODE_REMOTE_SESSION_ID: "",
    });
    assert.equal(first.code, 0, first.output);
    assert(first.output.includes("Installing"));
    assert(first.output.includes("Preparing"));
    assert(first.output.includes("Play here: http://127.0.0.1:" + port));
    const record = JSON.parse(
      readFileSync(join(fixture, ".runtime/play-server.json"), "utf8"),
    );
    ownedPid = record.pid;
    const health = await (
      await fetch("http://127.0.0.1:" + port + "/api/health")
    ).json();
    assert.equal(health.pid, ownedPid);
    assert.equal(health.instance, record.instance);
    assert(
      (await (await fetch("http://127.0.0.1:" + port)).text()).includes(
        "Swarm Game Engine",
      ),
    );
    assert(
      (await (await fetch("http://127.0.0.1:" + port + "/api/packages")).json())
        .length >= 3,
    );
    const repeat = await run(["--background", "--port", String(port)], {
      CLAUDE_CODE_REMOTE: "",
      CLAUDE_CODE_REMOTE_SESSION_ID: "",
    });
    assert.equal(repeat.code, 0, repeat.output);
    assert(repeat.output.includes("already running"));
    assert(!repeat.output.includes("Installing"));
    assert.equal(
      JSON.parse(
        readFileSync(join(fixture, ".runtime/play-server.json"), "utf8"),
      ).pid,
      ownedPid,
    );
    mkdirSync(join(fixture, "public"), { recursive: true });
    writeFileSync(
      join(fixture, "public", "workshop-check.txt"),
      "updated game asset",
    );
    const rebuilt = await run(["--background", "--port", String(port)], {
      CLAUDE_CODE_REMOTE: "",
      CLAUDE_CODE_REMOTE_SESSION_ID: "",
    });
    assert.equal(rebuilt.code, 0, rebuilt.output);
    assert(rebuilt.output.includes("Preparing"));
    assert(!rebuilt.output.includes("Installing"));
    assert.notEqual(
      JSON.parse(
        readFileSync(join(fixture, ".runtime/play-server.json"), "utf8"),
      ).pid,
      ownedPid,
    );
    assert.equal(
      await (
        await fetch("http://127.0.0.1:" + port + "/workshop-check.txt")
      ).text(),
      "updated game asset",
    );
    const stopped = await run(["--stop"]);
    assert.equal(stopped.code, 0, stopped.output);
    const cloud = await run([
      "--background",
      "--cloud",
      "--port",
      String(port),
    ]);
    assert.equal(cloud.code, 0, cloud.output);
    assert(cloud.output.includes("inside this cloud workspace"));
    assert(!cloud.output.includes("Play here:"));
    assert.equal(
      JSON.parse(
        readFileSync(join(fixture, ".runtime/play-server.json"), "utf8"),
      ).host,
      "0.0.0.0",
    );
    await run(["--stop"]);
    const foreign = http.createServer((req, res) => res.end("another app"));
    await new Promise((resolve) => foreign.listen(port, "127.0.0.1", resolve));
    try {
      const occupied = await run(["--background", "--port", String(port)]);
      assert.notEqual(occupied.code, 0);
      assert(occupied.output.includes("already in use"));
      assert.equal(
        await (await fetch("http://127.0.0.1:" + port)).text(),
        "another app",
      );
      const stop = await run(["--stop"]);
      assert(stop.output.includes("No launcher-owned"));
      assert.equal(
        await (await fetch("http://127.0.0.1:" + port)).text(),
        "another app",
      );
    } finally {
      await new Promise((resolve) => foreign.close(resolve));
    }
  } finally {
    await run(["--stop"]);
    if (
      dirname(fixture) === tmpdir() &&
      basename(fixture).startsWith("swarm-launcher-")
    )
      rmSync(fixture, { recursive: true, force: true });
  }
});

test("build fingerprint notices graphics and sound changes", () => {
  const root = mkdtempSync(join(tmpdir(), "swarm-fingerprint-"));
  try {
    mkdirSync(join(root, "public"));
    const original = fingerprint(root);
    writeFileSync(join(root, "public", "tile.png"), "first image");
    const image = fingerprint(root);
    assert.notEqual(original, image);
    assert.equal(image, fingerprint(root));
    writeFileSync(join(root, "public", "tile.png"), "changed image");
    assert.notEqual(image, fingerprint(root));
    const changed = fingerprint(root);
    writeFileSync(join(root, "public", "effect.wav"), "sound");
    assert.notEqual(changed, fingerprint(root));
  } finally {
    if (
      dirname(root) === tmpdir() &&
      basename(root).startsWith("swarm-fingerprint-")
    )
      rmSync(root, { recursive: true, force: true });
  }
});
