import type { GamePackage } from "./types.ts";
export function validateBase(p: GamePackage): string[] {
  const errors: string[] = [];
  const check = (v: unknown, m: string) => {
    if (!v) errors.push(m);
  };
  const safe = (v: unknown) =>
    typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(v);
  check(/^[a-z][a-z0-9-]{1,63}$/.test(p?.id), "id: invalid");
  check(/^\d+\.\d+\.\d+$/.test(p?.version), "version: invalid");
  for (const k of ["name", "author", "description", "license", "help"])
    check(typeof p?.[k] === "string" && p[k].length < 20000, "metadata: " + k);
  check(
    Array.isArray(p?.areas) &&
      p.areas.length <= 100 &&
      p.areas.every((a) => safe(a?.id) && typeof a.shared === "boolean") &&
      new Set(p.areas.map((a) => a.id)).size === p.areas.length,
    "areas: invalid",
  );
  check(
    Array.isArray(p?.tiles) && p.tiles.length > 0 && p.tiles.length <= 2000,
    "tiles: invalid count",
  );
  if (errors.length) return errors;
  const tiles = new Map(p.tiles.map((t) => [t.id, t]));
  check(tiles.size === p.tiles.length, "tiles: duplicate");
  for (const t of p.tiles) {
    check(
      safe(t?.id) &&
        Number.isSafeInteger(t.q) &&
        Number.isSafeInteger(t.r) &&
        typeof t.terrain === "string" &&
        p.areas.some((a) => a.id === t.area) &&
        Array.isArray(t.edges) &&
        t.edges.length === 6,
      "tiles: invalid entry",
    );
    if (Array.isArray(t.edges))
      t.edges.forEach((to, d) =>
        check(
          to === null ||
            (typeof to === "string" &&
              tiles.get(to)?.edges?.[(d + 3) % 6] === t.id),
          "tiles: invalid reciprocal edge",
        ),
      );
  }
  check(
    Array.isArray(p.dependencies) &&
      p.dependencies.every(
        (d) =>
          safe(d?.id) &&
          d.id !== p.id &&
          /^\d+\.\d+\.\d+$/.test(d.version) &&
          /^[a-f0-9]{64}$/.test(d.digest),
      ),
    "dependencies: invalid",
  );
  check(
    Array.isArray(p.capabilities) &&
      p.capabilities.every((x) =>
        [
          "hex",
          "decisions",
          "effects",
          "private-observation",
          "trusted-modules",
        ].includes(x),
      ),
    "capabilities: unsupported",
  );
  check(
    p.presentation && /^#[a-f0-9]{6}$/i.test(p.presentation.background),
    "presentation: invalid",
  );
  if (p.presentation?.sounds)
    check(
      Object.values(p.presentation.sounds).every(
        (c) =>
          Number.isFinite(c.frequency) &&
          c.frequency >= 40 &&
          c.frequency <= 5000 &&
          Number.isFinite(c.duration) &&
          c.duration >= 0.02 &&
          c.duration <= 2,
      ),
      "presentation: invalid cue",
    );
  if (p.privateData)
    check(
      Object.entries(p.privateData).every(
        ([k, v]) => /^p[1-6]$/.test(k) && typeof v === "string",
      ),
      "privateData: invalid",
    );
  return errors;
}
