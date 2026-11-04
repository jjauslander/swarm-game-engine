import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pack, digest } from "./index.ts";
import type { GamePackage } from "../engine/types.ts";
export async function preview(p: GamePackage) {
  const origin = "http://127.0.0.1:5174";
  let running = false;
  try {
    running = (await fetch(origin + "/api/packages")).ok;
  } catch {}
  const startedHost = !running;
  if (!running) {
    if (!existsSync("dist/index.html"))
      throw Error("Run npm run build before starting preview");
    const child = spawn(
      process.execPath,
      ["--import", "tsx", resolve("packages/host/server.ts")],
      {
        cwd: process.cwd(),
        detached: true,
        windowsHide: true,
        stdio: "ignore",
      },
    );
    child.unref();
    mkdirSync(".runtime", { recursive: true });
    writeFileSync(
      ".runtime/preview-process.json",
      JSON.stringify({ pid: child.pid, origin }),
    );
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(origin + "/api/packages")).ok) {
          running = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  if (!running) throw Error("Preview host did not start");
  const r = await fetch(origin + "/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archive: Buffer.from(pack(p)).toString("base64") }),
  });
  if (!r.ok) throw Error((await r.json()).message);
  return {
    url: origin + "/?package=" + digest(p),
    packageDigest: digest(p),
    startedHost,
  };
}
