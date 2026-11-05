import { createOperations, type Operations } from "./extensions.ts";

import type { GamePackage } from "./types.ts";
export const capabilities = [
  "hex",
  "trusted-modules",
  "decisions",
  "effects",
  "private-observation",
];
export function validate(p: any, operations: Operations = createOperations()) {
  const errors: string[] = [];
  const check = (v: any, m: string) => {
    if (!v) errors.push(m);
  };
  check(p?.schema === 2, "schema: expected 2");
  check(/^[a-z][a-z0-9-]{1,63}$/.test(p?.id), "id: invalid identifier");
  check(/^\d+\.\d+\.\d+$/.test(p?.version), "version: expected semver");
  check(p?.engine === "2", "engine: unsupported compatibility");
  check(typeof p?.name === "string" && p.name.length < 100, "name: invalid");
  check(
    Array.isArray(p?.tiles) && p.tiles.length > 0 && p.tiles.length <= 2000,
    "tiles: expected 1–2000",
  );
  if (errors.length) return errors;
  const safeId = (v: any) =>
    typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(v);
  check(
    Array.isArray(p.areas) &&
      p.areas.every((a) => safeId(a.id) && typeof a.shared === "boolean"),
    "areas: invalid ID",
  );
  check(p.types && Object.keys(p.types).every(safeId), "types: invalid ID");
  if (errors.length) return errors;
  check(
    new Set(p.tiles.map((t) => t.id)).size === p.tiles.length,
    "tiles: duplicate ID",
  );
  check(
    Array.isArray(p.areas) &&
      new Set(p.areas.map((a) => a.id)).size === p.areas.length,
    "areas: duplicate or invalid",
  );
  for (const t of p.tiles) {
    check(
      safeId(t.id) && Number.isInteger(t.q) && Number.isInteger(t.r),
      "tiles: malformed coordinates",
    );
    check(
      p.areas.some((a) => a.id === t.area),
      "tiles." + t.id + ": missing area",
    );
    check(
      Array.isArray(t.edges) && t.edges.length === 6,
      "tiles." + t.id + ": six directional edges required",
    );
    for (let d = 0; d < 6; d++)
      if (t.edges?.[d]) {
        const target = p.tiles.find((x) => x.id === t.edges[d]);
        check(
          target?.edges[(d + 3) % 6] === t.id,
          "tiles." + t.id + ": invalid reciprocal edge",
        );
      }
  }
  check(
    Array.isArray(p.capabilities) &&
      p.capabilities.every((c) => capabilities.includes(c)),
    "capabilities: unsupported",
  );
  check(Array.isArray(p.dependencies), "dependencies: missing");
  for (const d of p.dependencies ?? [])
    check(
      d.id !== p.id && /^[a-f0-9]{64}$/.test(d.digest),
      "dependencies: invalid/self dependency",
    );
  check(
    !p.rules?.systemOperation || operations.has(p.rules.systemOperation),
    "rules.systemOperation: unsupported registered operation",
  );
  check(
    p.types &&
      Object.values(p.types).every(
        (t: any) =>
          typeof t.label === "string" &&
          typeof t.symbol === "string" &&
          Number.isInteger(t.cargo) &&
          t.cargo >= 0 &&
          t.cargo <= 2 &&
          Number.isInteger(t.segments) &&
          t.segments >= 0 &&
          t.segments <= 2 &&
          Number.isInteger(t.population) &&
          t.population >= 0,
      ),
    "types: invalid",
  );
  check(
    p.rules &&
      Number.isInteger(p.rules.ap) &&
      p.rules.ap > 0 &&
      p.rules.ap <= 100 &&
      Number.isInteger(p.rules.goal) &&
      p.rules.goal > 0 &&
      p.rules.support > 0 &&
      Number.isInteger(p.rules.floodEvery) &&
      p.rules.floodEvery >= 0 &&
      p.rules.floodDuration === 1,
    "rules: invalid budgets/timing",
  );
  check(
    Array.isArray(p.rules?.products) &&
      p.rules.products.every((x) => p.types[x]),
    "rules.products: missing type",
  );
  check(
    Array.isArray(p.rules?.floodTiles) &&
      p.rules.floodTiles.every((t) =>
        p.tiles.some((x) => x.id === t && x.terrain !== "flower"),
      ),
    "rules.floodTiles: invalid",
  );
  check(
    Array.isArray(p.setup) &&
      p.setup.length <= 500 &&
      new Set(p.setup.map((x) => x.id)).size === p.setup.length,
    "setup: invalid/duplicate entities",
  );
  for (const e of p.setup ?? []) {
    check(
      safeId(e.id) &&
        Object.hasOwn(p.types, e.type) &&
        p.tiles.some((t) => t.id === e.tile) &&
        p.areas.some((a) => a.id === e.origin),
      "setup." + e.id + ": invalid reference",
    );
    check(
      e.carrier === null && e.pollen === 0,
      "setup: expected settled empty cargo",
    );
  }
  check(
    typeof p.help === "string" &&
      p.presentation &&
      /^#[a-f0-9]{6}$/i.test(p.presentation.background) &&
      /^#[a-f0-9]{6}$/i.test(p.presentation.floodColor),
    "presentation: invalid",
  );
  check(
    typeof p.author === "string" &&
      p.author.length > 0 &&
      typeof p.description === "string" &&
      typeof p.license === "string",
    "metadata: author, description and license required",
  );
  check(
    !p.presentation.sounds ||
      Object.values(p.presentation.sounds).every(
        (cue: any) =>
          Number.isFinite(cue.frequency) &&
          cue.frequency >= 40 &&
          cue.frequency <= 5000 &&
          Number.isFinite(cue.duration) &&
          cue.duration > 0 &&
          cue.duration <= 2,
      ),
    "presentation.sounds: invalid finite cue",
  );
  const allowed = [
    "author",
    "description",
    "license",
    "schema",
    "module",
    "id",
    "name",
    "version",
    "engine",
    "dependencies",
    "capabilities",
    "tiles",
    "areas",
    "types",
    "rules",
    "setup",
    "help",
    "presentation",
    "privateData",
  ];
  check(
    Object.keys(p).every((k) => allowed.includes(k)),
    "package: unsupported field or script",
  );
  return errors;
}
