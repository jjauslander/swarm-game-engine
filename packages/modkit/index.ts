import { validate, unpack } from "../engine/package.ts";
export { validate, unpack, capabilities } from "../engine/package.ts";
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { resolve, relative, isAbsolute, dirname } from "node:path";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import {
  create,
  stable,
  actions,
  submit,
  decisionOwner,
  tile,
} from "../engine/index.ts";
import type { GamePackage, Match } from "../engine/types.ts";
export function digest(p: GamePackage) {
  return createHash("sha256").update(stable(p)).digest("hex");
}
export function load(path: string): GamePackage {
  const p = JSON.parse(readFileSync(path, "utf8"));
  const errors = validate(p);
  if (errors.length) throw Error(errors.join("\n"));
  return p;
}
export function resolveDependencies(
  p: GamePackage,
  installed: GamePackage[],
  stack: string[] = [],
  resolved = new Map<string, string>(),
) {
  if (stack.includes(p.id)) throw Error("Dependency cycle");
  const prior = resolved.get(p.id);
  if (prior && prior !== digest(p))
    throw Error("Conflicting dependency " + p.id);
  resolved.set(p.id, digest(p));
  for (const d of p.dependencies) {
    const dep = installed.find(
      (x) => x.id === d.id && x.version === d.version && digest(x) === d.digest,
    );
    if (!dep) throw Error("Missing exact dependency " + d.id);
    resolveDependencies(dep, installed, [...stack, p.id], resolved);
  }
}
export function pack(p: GamePackage) {
  const errors = validate(p);
  if (errors.length) throw Error(errors.join("\n"));
  return zipSync({ "package.json": strToU8(stable(p)) }, { level: 6 });
}
export function choose(p: GamePackage, s: Match) {
  const who = decisionOwner(s),
    all = actions(p, s, who);
  if (!all.length) return null;
  if (s.core.decision) {
    const d = s.core.decision;
    if (d.kind === "production")
      return all.find((x) => x.option.startsWith("honey:")) ?? all[0];
    return all[0];
  }
  const moves = all.filter((x) => x.type === "move");
  const dist = (a: any, b: any) =>
    Math.max(
      Math.abs(a.q - b.q),
      Math.abs(a.r - b.r),
      Math.abs(a.q + a.r - b.q - b.r),
    );
  const scored = moves
    .map((c) => {
      const e = s.core.entities[c.actor],
        targets = p.tiles.filter((t) =>
          e.pollen
            ? Object.values(s.core.entities).some(
                (q) =>
                  p.types[q.type].queen &&
                  q.tile === t.id &&
                  s.core.owners[q.origin] === who,
              )
            : t.terrain === "flower",
        );
      const distance = (t: string) =>
        Math.min(...targets.map((x) => dist(tile(p, t), x)));
      return {
        c,
        score:
          distance(e.tile) - distance(c.route.at(-1)) + (e.pollen ? 0.01 : 0),
      };
    })
    .sort(
      (a, b) => b.score - a.score || stable(a.c).localeCompare(stable(b.c)),
    );
  return scored[0]?.score > 0 ? scored[0].c : all[0];
}
export function simulate(p: GamePackage, limit = 500, seed = 12345) {
  const areas = p.areas.filter((a) => !a.shared);
  let s = create(
    p,
    digest(p),
    { [areas[0].id]: "p1", [areas.at(-1)!.id]: "p2" },
    seed,
  );
  for (let i = 0; i < limit && !s.core.winner; i++) {
    const c = choose(p, s);
    if (!c) break;
    s = submit(p, s, decisionOwner(s), {
      matchId: s.id,
      revision: s.revision,
      command: c,
    });
  }
  return { decisions: s.revision, winner: s.core.winner, match: s };
}
export function catalog() {
  return readdirSync("mods", { withFileTypes: true })
    .filter((x) => x.isDirectory())
    .map((x) => load("mods/" + x.name + "/package.json"));
}
export class Workspace {
  root: string;
  constructor(root: string) {
    mkdirSync(root, { recursive: true });
    this.root = realpathSync(root);
  }
  path(name: string) {
    if (!/^[a-z0-9-]+$/.test(name))
      throw Error("Invalid workspace package name");
    const path = resolve(this.root, name, "package.json");
    const rel = relative(this.root, path);
    if (isAbsolute(rel) || rel.startsWith(".."))
      throw Error("Outside workspace");
    try {
      const actual = realpathSync(dirname(path));
      if (
        relative(this.root, actual).startsWith("..") ||
        isAbsolute(relative(this.root, actual))
      )
        throw Error("Symlink outside workspace");
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
    return path;
  }
  create(name: string, p: GamePackage) {
    const path = this.path(name);
    try {
      statSync(path);
      throw Error("Already exists");
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
    const next = { ...structuredClone(p), id: name, name };
    this.write(name, next);
    return next;
  }
  write(name: string, p: GamePackage) {
    const errors = validate(p);
    if (errors.length) throw Error(errors.join("\n"));
    const path = this.path(name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(p, null, 2));
    return { digest: digest(p) };
  }
  read(name: string) {
    return load(this.path(name));
  }
}
