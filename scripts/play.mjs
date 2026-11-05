import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  openSync,
  closeSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import net from "node:net";

export function parseOptions(args, env = process.env) {
  const options = {
    background: false,
    cloud:
      env.CLAUDE_CODE_REMOTE === "true" || !!env.CLAUDE_CODE_REMOTE_SESSION_ID,
    stop: false,
    port: env.PORT ? Number(env.PORT) : null,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--background") options.background = true;
    else if (a === "--cloud") options.cloud = true;
    else if (a === "--stop") options.stop = true;
    else if (a === "--port") options.port = Number(args[++i]);
    else
      throw Error(
        "Unknown option " +
          a +
          ". Use --background, --cloud, --port NUMBER or --stop.",
      );
  }
  if (
    options.port !== null &&
    (!Number.isInteger(options.port) ||
      options.port < 1024 ||
      options.port > 65535)
  )
    throw Error("Choose a port between 1024 and 65535.");
  return options;
}
export function fingerprint(root) {
  const hash = createHash("sha256");
  function visit(relative) {
    const path = resolve(root, relative);
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true }).sort(
      (a, b) => (a.name < b.name ? -1 : 1),
    )) {
      const name = relative + "/" + entry.name;
      if (entry.isDirectory()) {
        if (!["node_modules", ".git", ".runtime", "dist"].includes(entry.name))
          visit(name);
      } else if (entry.isFile()) {
        hash.update(name);
        hash.update(readFileSync(resolve(root, name)));
      }
    }
  }
  for (const dir of [
    "packages",
    "games",
    "mods",
    "scripts",
    "public",
    "assets",
  ])
    visit(dir);
  for (const file of [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
  ])
    if (existsSync(resolve(root, file))) {
      hash.update(file);
      hash.update(readFileSync(resolve(root, file)));
    }
  return hash.digest("hex");
}
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
async function health(port) {
  try {
    const response = await fetch("http://127.0.0.1:" + port + "/api/health", {
      signal: AbortSignal.timeout(1500),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
async function free(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => server.close(() => resolve(true)));
  });
}
function npm(root, args) {
  // npm itself supplies its JS entry point; no shell-built user input.
  let cli = process.env.npm_execpath;
  if (!cli || !existsSync(cli)) {
    const locate = spawnSync(
      process.platform === "win32" ? "where.exe" : "which",
      ["npm"],
      { encoding: "utf8", windowsHide: true },
    );
    const executable = locate.stdout?.trim().split(/\r?\n/)[0];
    const candidates = [
      resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
      executable &&
        resolve(dirname(executable), "node_modules/npm/bin/npm-cli.js"),
      "/usr/share/nodejs/npm/bin/npm-cli.js",
    ];
    cli = candidates.find((p) => p && existsSync(p));
  }
  if (!cli)
    throw Error("npm was not found. Install Node 22.12+ with npm, then retry.");
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw Error(
      "npm " +
        args.join(" ") +
        " did not finish. The installation/build output above explains why.",
    );
}
async function stopOwned(record) {
  if (!record) return false;
  const running = await health(record.port);
  if (
    running?.service !== "swarm-game-engine" ||
    running.instance !== record.instance ||
    running.pid !== record.pid
  )
    return false;
  process.kill(record.pid);
  for (let i = 0; i < 40; i++) {
    if (!(await health(record.port))) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("The game server did not stop. No other process was touched.");
}
export async function main(
  args = process.argv.slice(2),
  root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
) {
  const options = parseOptions(args),
    runtime = resolve(root, ".runtime");
  mkdirSync(runtime, { recursive: true });
  const recordPath = resolve(runtime, "play-server.json"),
    stampPath = resolve(runtime, "play-build.json");
  let record = readJson(recordPath);
  if (options.stop) {
    console.log(
      (await stopOwned(record))
        ? "Game server stopped. Saved games are kept."
        : "No launcher-owned game server is running.",
    );
    return;
  }
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 12))
    throw Error("This game needs Node 22.12 or newer.");
  const lock = createHash("sha256")
    .update(readFileSync(resolve(root, "package-lock.json")))
    .update(process.versions.node)
    .digest("hex");
  const stamp = readJson(stampPath);
  if (
    !existsSync(resolve(root, "node_modules/tsx/dist/cli.mjs")) ||
    stamp?.install !== lock
  ) {
    console.log("Installing what the games need…");
    npm(root, ["ci"]);
  }
  let build = fingerprint(root);
  if (
    !existsSync(resolve(root, "dist/index.html")) ||
    stamp?.build !== build ||
    stamp?.install !== lock
  ) {
    console.log("Preparing the playable games…");
    npm(root, ["run", "build"]);
    build = fingerprint(root);
    writeFileSync(stampPath, JSON.stringify({ install: lock, build }, null, 2));
  }
  const host = options.cloud ? "0.0.0.0" : "127.0.0.1";
  let running = record && (await health(record.port));
  if (
    running?.instance === record?.instance &&
    running?.service === "swarm-game-engine" &&
    running?.build === build &&
    record.host === host &&
    (!options.port || record.port === options.port)
  ) {
    console.log("The games are already running.");
    printReady(record, options);
    return;
  }
  await stopOwned(record);
  let port = options.port ?? 5174;
  if (options.port) {
    if (!(await free(port, host)))
      throw Error(
        "Port " +
          port +
          " is already in use. Keep that service, or choose another --port.",
      );
  } else {
    while (port < 5190 && !(await free(port, host))) port++;
    if (port === 5190)
      throw Error("No free game port was found. Choose a free --port.");
  }
  console.log("Starting the game server…");
  const instance = randomUUID(),
    logPath = resolve(runtime, "play-server.log");
  const log = openSync(logPath, "a");
  const child = spawn(
    process.execPath,
    ["--import", "tsx", resolve(root, "packages/host/server.ts")],
    {
      cwd: root,
      env: {
        ...process.env,
        HOST: host,
        PORT: String(port),
        SWARM_PLAY_INSTANCE: instance,
        SWARM_BUILD_ID: build,
      },
      detached: options.background,
      windowsHide: true,
      stdio: options.background ? ["ignore", log, log] : "inherit",
    },
  );
  closeSync(log);
  let spawnError;
  child.on("error", (e) => {
    spawnError = e;
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) break;
    running = await health(port);
    if (running?.instance === instance) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) {
    if (child.pid && child.exitCode === null) child.kill();
    throw Error(
      "The game server did not become ready. See .runtime/play-server.log.",
    );
  }
  record = {
    pid: child.pid,
    instance,
    port,
    host,
    build,
    localUrl: "http://127.0.0.1:" + port,
  };
  writeFileSync(recordPath, JSON.stringify(record, null, 2));
  printReady(record, options);
  if (options.background) {
    child.unref();
    return;
  }
  process.on("SIGINT", () => child.kill());
  process.on("SIGTERM", () => child.kill());
  await new Promise((resolve) => child.once("exit", resolve));
}
function printReady(record, options) {
  if (options.cloud) {
    console.log(
      "The games are ready inside this cloud workspace on port " +
        record.port +
        ".",
    );
    console.log(
      "Ask the coding assistant to open the workspace's preview/forwarded URL. A localhost address here is not a play link on your own computer.",
    );
  } else console.log("Play here: " + record.localUrl);
  console.log("Choose a game, then Play locally. Player two can be a bot.");
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((e) => {
    console.error("Setup could not finish: " + e.message);
    process.exitCode = 1;
  });
}
