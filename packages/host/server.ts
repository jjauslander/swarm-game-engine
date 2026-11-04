import http from "node:http";
import { randomBytes } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  renameSync,
} from "node:fs";
import { resolve, extname, relative, isAbsolute } from "node:path";
import {
  catalog,
  digest,
  resolveDependencies,
  unpack,
  pack,
  choose,
} from "../modkit/index.ts";
import {
  create,
  submit,
  view,
  snapshot,
  restore,
  decisionOwner,
  copy,
} from "../engine/index.ts";
import type { GamePackage, Match } from "../engine/types.ts";
const root = process.env.SWARM_HOST_DATA ?? ".runtime/host";
mkdirSync(root, { recursive: true });
const packages = catalog();
mkdirSync(root + "/packages", { recursive: true });
for (const file of readdirSync(root + "/packages")) {
  try {
    const p = unpack(readFileSync(root + "/packages/" + file));
    if (!packages.some((x) => digest(x) === digest(p))) packages.push(p);
  } catch {
    console.error(
      "Skipped incompatible development package " + file + "; file retained",
    );
  }
}
const matches = new Map<
  string,
  {
    p: GamePackage;
    s: Match;
    tokens: Record<string, string>;
    requests: Record<string, { fingerprint: string; result: any }>;
    paused?: boolean;
  }
>();
const token = () => randomBytes(24).toString("hex");
if (existsSync(root + "/matches.json"))
  for (const [k, v] of JSON.parse(
    readFileSync(root + "/matches.json", "utf8"),
  )) {
    const p = packages.find((p) => digest(p) === v.digest);
    if (p) {
      try {
        matches.set(k, {
          p,
          s: restore(p, v.digest, v.save),
          tokens: v.tokens,
          requests: v.requests ?? {},
          paused: v.paused ?? false,
        });
      } catch {
        writeFileSync(
          root + "/rejected-checkpoint.json",
          readFileSync(root + "/matches.json"),
        );
        console.error(
          "Skipped incompatible development checkpoint " +
            k +
            "; original retained in rejected-checkpoint.json",
        );
      }
    }
  }
function persist() {
  writeFileSync(
    root + "/matches.tmp",
    JSON.stringify(
      [...matches].map(([k, v]) => [
        k,
        {
          digest: digest(v.p),
          save: snapshot(v.p, v.s),
          tokens: v.tokens,
          requests: v.requests,
          paused: v.paused ?? false,
        },
      ]),
    ),
  );
  renameSync(root + "/matches.tmp", root + "/matches.json");
}
function publicPackage(p: GamePackage) {
  const n = copy(p);
  delete n.privateData;
  return n;
}
export const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  try {
    const url = new URL(req.url!, "http://localhost");
    if (!url.pathname.startsWith("/api/")) {
      const path = resolve("dist", "." + url.pathname);
      if (
        relative(resolve("dist"), path).startsWith("..") ||
        isAbsolute(relative(resolve("dist"), path))
      )
        throw Error("Invalid path");
      const file =
        existsSync(path) && extname(path) ? path : resolve("dist/index.html");
      res.setHeader(
        "Content-Type",
        (
          {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
          } as any
        )[extname(file)] ?? "application/octet-stream",
      );
      res.end(readFileSync(file));
      return;
    }
    if (
      req.method === "POST" &&
      !req.headers["content-type"]?.startsWith("application/json")
    )
      throw Error("JSON requests required");
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 3000000) throw Error("Request too large");
    }
    const body = raw ? JSON.parse(raw) : {};
    const send = (v: any) => res.end(JSON.stringify(v));
    if (url.pathname === "/api/packages" && req.method === "GET")
      return send(
        packages.map((p) => ({ package: publicPackage(p), digest: digest(p) })),
      );
    if (url.pathname === "/api/import" && req.method === "POST") {
      const p = unpack(Buffer.from(body.archive, "base64"));
      resolveDependencies(p, packages);
      if (p.privateData) throw Error("Private fixtures are host-only");
      const old = packages.find(
        (x) => x.id === p.id && x.version === p.version,
      );
      if (old && digest(old) !== digest(p))
        throw Error("Version already installed with different content");
      if (!old) {
        writeFileSync(root + "/packages/" + digest(p) + ".hexmod", pack(p));
        packages.push(p);
      }
      return send({ digest: digest(p) });
    }
    if (url.pathname === "/api/create" && req.method === "POST") {
      const p = packages.find((p) => digest(p) === body.digest);
      if (!p) throw Error("Package unavailable");
      resolveDependencies(p, packages);
      const s = create(
        p,
        digest(p),
        body.owners,
        body.seed,
        true,
        Object.fromEntries((body.bots ?? []).map((id) => [id, "bot"])),
      );
      s.id += "-" + token();
      const tokens = Object.fromEntries(
        Object.keys(s.controllers).map((id) => [token(), id]),
      );
      matches.set(s.id, { p, s, tokens, requests: {} });
      persist();
      return send({
        id: s.id,
        seats: Object.entries(tokens).map(([token, player]) => ({
          player,
          token,
        })),
      });
    }
    const m = matches.get(body.id ?? url.searchParams.get("id")!);
    const auth = req.headers.authorization?.replace(/^Bearer /, "");
    const who = auth && m?.tokens[auth];
    if (!m || !who) throw Error("Seat authentication required");
    if (url.pathname === "/api/view") {
      if (body.digest && body.digest !== digest(m.p))
        throw Error("Package mismatch");
      return send({ ...view(m.p, m.s, who), botsPaused: m.paused ?? false });
    }
    if (url.pathname === "/api/bots") {
      if (typeof body.paused !== "boolean") throw Error("Expected paused flag");
      m.paused = body.paused;
      persist();
      return send({ paused: m.paused });
    }
    if (url.pathname === "/api/command") {
      if (typeof body.requestId !== "string" || body.requestId.length > 100)
        throw Error("Request ID required");
      const key = who + ":" + body.requestId,
        fingerprint = JSON.stringify(body);
      if (m.requests[key]) {
        if (m.requests[key].fingerprint !== fingerprint)
          throw Error("Request ID reused");
        return send(m.requests[key].result);
      }
      const n = submit(m.p, m.s, who, { ...body, matchId: m.s.id });
      m.s = n;
      const result = { revision: n.revision };
      m.requests[key] = { fingerprint, result };
      persist();
      return send(result);
    }
    throw Error("Unknown endpoint");
  } catch (e: any) {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error: e.code ?? "REJECTED",
        message: e.message ?? "Request rejected",
      }),
    );
  }
});
const botTimer = setInterval(() => {
  for (const m of matches.values()) {
    const who = decisionOwner(m.s);
    if (m.paused || m.s.controllers[who] !== "bot" || m.s.core.winner) continue;
    try {
      const c = choose(m.p, m.s);
      if (c) {
        m.s = submit(m.p, m.s, who, {
          matchId: m.s.id,
          revision: m.s.revision,
          command: c,
        });
        persist();
      }
    } catch (e) {
      console.error("Bot action failed", String(e));
    }
  }
}, 400);
botTimer.unref();
server.on("close", () => clearInterval(botTimer));
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/host/server.ts"))
  server.listen(
    Number(process.env.PORT ?? 5174),
    process.env.HOST ?? "127.0.0.1",
    () => console.log("Authority ready on " + (process.env.PORT ?? 5174)),
  );
