import { identities } from "../packages/composition/identities.ts";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { createHash } from "node:crypto";
/** Hash normalized trusted source graph, including transitive execution services.
 * Generated identity constants are an excluded input to avoid self-reference.
 * No arbitrary runtime/imported scripts are discovered or evaluated. */
export function sourceDigest(entry: string) {
  const visited = new Map<string, string>();
  function visit(path: string) {
    path = resolve(path);
    if (path.replaceAll("\\", "/").endsWith("composition/identities.ts"))
      return;
    if (visited.has(path)) return;
    const source = readFileSync(path, "utf8").replaceAll("\r\n", "\n");
    visited.set(path, source);
    for (const match of source.matchAll(
      /(?:from\s*|import\s*)["'](\.[^"']+\.ts)["']/g,
    ))
      visit(resolve(dirname(path), match[1]));
  }
  visit(entry);
  visit("packages/engine/index.ts");
  return createHash("sha256")
    .update(
      JSON.stringify(
        [...visited]
          .map(([p, s]) => [
            relative(process.cwd(), p).replaceAll("\\", "/"),
            s,
          ])
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    )
    .digest("hex");
}
export function verifySources() {
  const sources = JSON.parse(
    readFileSync("packages/composition/module-sources.json", "utf8"),
  ) as Record<string, { entry: string; version: string }>;
  for (const [key, source] of Object.entries(sources))
    if (
      identities[key]?.digest !== sourceDigest(source.entry) ||
      identities[key]?.version !== source.version
    )
      throw Error(
        "Trusted rule source changed. Run npm run identities and rebuild/restart; existing matches require their exact module build.",
      );
}
if (
  process.argv[1]
    ?.replaceAll("\\", "/")
    .endsWith("/scripts/module-identities.ts")
) {
  const sources = JSON.parse(
    readFileSync("packages/composition/module-sources.json", "utf8"),
  ) as Record<string, { entry: string; version: string }>;
  const identities = Object.fromEntries(
    Object.entries(sources).map(([id, source]) => [
      id,
      {
        id,
        api: 1,
        version: source.version,
        digest: sourceDigest(source.entry),
      },
    ]),
  );
  const file = "packages/composition/identities.ts";
  const text =
    "// Generated from transitive trusted source. Run npm run identities.\nexport const identities = " +
    JSON.stringify(identities, null, 2) +
    " as const;\n";
  if (process.argv.includes("--check")) {
    if (readFileSync(file, "utf8").replaceAll("\r\n", "\n") !== text)
      throw Error("Stale module identities: run npm run identities");
  } else {
    writeFileSync(file, text);
    for (const dir of readdirSync("mods")) {
      const path = "mods/" + dir + "/package.json";
      const p = JSON.parse(readFileSync(path, "utf8"));
      if (identities[p.module?.id]) {
        p.module = identities[p.module.id];
        writeFileSync(path, JSON.stringify(p, null, 2) + "\n");
      }
    }
  }
}
