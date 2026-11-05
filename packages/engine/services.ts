import { RuleError } from "./types.ts";
import type { GamePackage, Match, Json } from "./types.ts";
export const stable = (v: unknown): string =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : x,
  );
export function hash(v: unknown) {
  let h = 2166136261;
  for (const c of stable(v)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
export const tile = (p: Pick<GamePackage, "tiles">, t: string) =>
  p.tiles.find((x) => x.id === t)!;
export function id(s: Match) {
  return "e" + ++s.allocator;
}
export function random(s: Match) {
  let n = s.rng;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  s.rng = n >>> 0;
  return s.rng / 4294967296;
}
export function emit(s: Match, type: string, data: Json, audience?: string) {
  if (s.events.filter((e) => e.revision === s.revision + 1).length >= 256)
    throw new RuleError("WORK_LIMIT", "Effect chain limit exceeded");
  s.events.push({
    seq: (s.events.at(-1)?.seq ?? 0) + 1,
    revision: s.revision + 1,
    transaction: s.allocator,
    type,
    data,
    ...(audience ? { audience } : {}),
  });
}
export function assertJson(value: unknown, depth = 0): void {
  if (depth > 64) throw Error("State nesting limit");
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    for (const x of value) assertJson(x, depth + 1);
    return;
  }
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    for (const [k, v] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(k))
        throw Error("Unsafe key");
      if (v !== undefined) assertJson(v, depth + 1);
    }
    return;
  }
  throw Error("Expected finite serializable data");
}
