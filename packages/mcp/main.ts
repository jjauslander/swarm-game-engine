import { preview } from "../modkit/preview.ts";
import { createInterface } from "node:readline";
import { writeFileSync } from "node:fs";
import {
  catalog,
  Workspace,
  validate,
  simulate,
  pack,
  capabilities,
} from "../modkit/index.ts";
const w = new Workspace(process.env.SWARM_MOD_WORKSPACE ?? ".runtime/mods");
const definitions = [
  ["capabilities", "Read capabilities and modding instructions", {}],
  ["list_packages", "List installed templates", {}],
  [
    "create_mod",
    "Copy a template into the configured workspace",
    { name: { type: "string" }, template: { type: "string" } },
  ],
  ["read_mod", "Read a workspace package", { name: { type: "string" } }],
  [
    "write_mod",
    "Validate and write workspace package",
    { name: { type: "string" }, package: { type: "object" } },
  ],
  ["validate_mod", "Validate workspace package", { name: { type: "string" } }],
  [
    "simulate_mod",
    "Run bounded seeded simulation",
    { name: { type: "string" }, limit: { type: "integer" } },
  ],
  ["pack_mod", "Pack workspace package", { name: { type: "string" } }],
  [
    "preview_mod",
    "Pack and give local import/preview instructions",
    { name: { type: "string" } },
  ],
];
async function call(name: string, a: any) {
  if (name === "capabilities")
    return {
      schema: 1,
      capabilities,
      guide:
        "Create from template, read_mod, edit rules.floodEvery, write_mod, validate_mod, simulate_mod, pack_mod, import the archive through Mods. No engine edits required.",
    };
  if (name === "list_packages")
    return catalog().map((p) => ({ id: p.id, name: p.name }));
  if (name === "create_mod") {
    const p = catalog().find((p) => p.id === a.template) ?? catalog()[0];
    return w.create(a.name, p);
  }
  if (name === "read_mod") return w.read(a.name);
  if (name === "write_mod") return w.write(a.name, a.package);
  const p = w.read(a.name);
  if (name === "validate_mod") return { errors: validate(p) };
  if (name === "simulate_mod") {
    const { match, ...result } = simulate(
      p,
      Math.min(1000, Math.max(1, a.limit ?? 300)),
    );
    return result;
  }
  if (name === "preview_mod") return preview(p);
  if (name === "pack_mod") {
    const archive = pack(p),
      path = w.path(a.name).replace("package.json", a.name + ".hexmod");
    writeFileSync(path, archive);
    return {
      path,
      preview:
        "http://127.0.0.1:5173 — Mods → Import package → select " + p.name,
      archive: Buffer.from(archive).toString("base64"),
    };
  }
  throw Error("Unknown tool");
}
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of rl) {
  let q: any;
  try {
    q = JSON.parse(line);
    if (q.id === undefined) continue;
    let result: any;
    if (q.method === "initialize")
      result = {
        protocolVersion: q.params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "swarm-modkit", version: "0.1.0" },
      };
    else if (q.method === "ping") result = {};
    else if (q.method === "tools/list")
      result = {
        tools: definitions.map(([name, description, properties]) => ({
          name,
          description,
          inputSchema: {
            type: "object",
            properties,
            additionalProperties: false,
          },
        })),
      };
    else if (q.method === "tools/call") {
      try {
        const data = await call(q.params.name, q.params.arguments ?? {});
        result = { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (e: any) {
        result = {
          isError: true,
          content: [{ type: "text", text: e.message }],
        };
      }
    } else {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: q.id,
          error: { code: -32601, message: "Method not found" },
        }) + "\n",
      );
      continue;
    }
    process.stdout.write(
      JSON.stringify({ jsonrpc: "2.0", id: q.id, result }) + "\n",
    );
  } catch (e: any) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: q?.id ?? null,
        error: { code: -32600, message: "Invalid request" },
      }) + "\n",
    );
  }
}
