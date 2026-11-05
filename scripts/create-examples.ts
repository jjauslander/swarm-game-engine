import { identities } from "../packages/composition/identities.ts";
import { mkdirSync, writeFileSync } from "node:fs";
const centres: any = {
    A: [-7, 3],
    B: [-3, -4],
    C: [4, -7],
    D: [7, -3],
    E: [3, 4],
    F: [-4, 7],
    G: [0, 0],
  },
  dirs = [
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
  ];
const tiles: any[] = [];
for (const [area, [cq, cr]] of Object.entries(centres) as any)
  for (let q = -3; q <= 3; q++)
    for (let r = -3; r <= 3; r++)
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 3)
        tiles.push({
          id: area + "-" + (q + 3) + "-" + (r + 3),
          area,
          q: q + cq,
          r: r + cr,
          terrain: q + cq === 0 && r + cr === 0 ? "flower" : "ordinary",
          edges: [],
        });
for (const t of tiles)
  t.edges = dirs.map(
    ([q, r]) =>
      tiles.find((x) => x.q === t.q + q && x.r === t.r + r)?.id ?? null,
  );
const setup: any[] = [];
for (const a of "ABCDEF") {
  const [q, r] = centres[a];
  for (const [suffix, type, dq, dr] of [
    ["q", "queen", 0, 0],
    ["w", "worker", 1, 0],
    ["b", "bumblebee", 0, 1],
    ["h", "honey", 0, -2],
  ] as any)
    setup.push({
      id: a + suffix,
      type,
      origin: a,
      tile: tiles.find((t) => t.q === q + dq && t.r === r + dr).id,
      pollen: 0,
      carrier: null,
    });
}
const p: any = {
  schema: 2,
  module: identities["swarm-basic"],
  author: "Swarm contributors",
  description: "Flat playable engine demonstration",
  license: "Apache-2.0",
  id: "swarm-basic-prototype",
  name: "Swarm Basic Prototype",
  version: "0.1.0",
  engine: "2",
  dependencies: [],
  capabilities: ["hex", "trusted-modules", "decisions"],
  tiles,
  areas: Object.keys(centres).map((id) => ({ id, shared: id === "G" })),
  types: {
    queen: {
      label: "Queen",
      symbol: "♛",
      cargo: 0,
      segments: 1,
      population: 0,
      queen: true,
    },
    worker: {
      label: "Worker",
      symbol: "✦",
      cargo: 1,
      segments: 1,
      population: 1,
    },
    bumblebee: {
      label: "Bumblebee",
      symbol: "✺",
      cargo: 1,
      segments: 2,
      population: 1,
    },
    honey: {
      label: "Honey Pot",
      symbol: "●",
      cargo: 0,
      segments: 0,
      population: 0,
      resource: true,
    },
  },
  rules: {
    ap: 6,
    support: 3,
    goal: 3,
    products: ["worker", "honey"],
    floodEvery: 0,
    floodDuration: 1,
    floodTiles: [],
  },
  setup,
  help: "Engine demonstration: collect pollen at the Flower, visit a Queen, choose Worker or Honey production, then depart free. First player spending three pollen on production wins after departure. Combat, theft, Swarms, walls, gestation, conquest and full-game victory are omitted.",
  presentation: {
    background: "#172a28",
    floodColor: "#4db7f5",
    sounds: {
      "entity.moved": { frequency: 185, duration: 0.17 },
      "entity.produced": { frequency: 690, duration: 0.17 },
      "activation.started": { frequency: 320, duration: 0.12 },
      "outcome.declared": { frequency: 880, duration: 0.25 },
      "effect.applied": { frequency: 220, duration: 0.2 },
    },
  },
};
for (const [id, name, every] of [
  ["swarm-basic-prototype", "Swarm Basic Prototype", 0],
  ["garden-cycle", "Garden Cycle", 3],
] as any) {
  const v = structuredClone(p);
  v.id = id;
  v.name = name;
  v.rules.floodEvery = every;
  v.rules.floodTiles = tiles
    .filter(
      (t) =>
        t.area === "G" &&
        t.terrain !== "flower" &&
        Math.max(Math.abs(t.q), Math.abs(t.r), Math.abs(t.q + t.r)) <= 1,
    )
    .map((t) => t.id);
  mkdirSync("mods/" + id, { recursive: true });
  writeFileSync("mods/" + id + "/package.json", JSON.stringify(v, null, 2));
}
