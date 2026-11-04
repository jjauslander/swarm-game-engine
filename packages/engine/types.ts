export interface Tile {
  id: string;
  area: string;
  q: number;
  r: number;
  terrain: string;
  edges: (string | null)[];
}
export interface Entity {
  id: string;
  type: string;
  origin: string;
  tile: string;
  pollen: number;
  carrier: string | null;
}
export interface GamePackage {
  author: string;
  description: string;
  license: string;
  schema: 1;
  id: string;
  name: string;
  version: string;
  engine: string;
  dependencies: { id: string; version: string; digest: string }[];
  capabilities: string[];
  tiles: Tile[];
  areas: { id: string; shared: boolean }[];
  types: Record<
    string,
    {
      label: string;
      symbol: string;
      cargo: number;
      segments: number;
      population: number;
      queen?: boolean;
      resource?: boolean;
    }
  >;
  rules: {
    ap: number;
    support: number;
    goal: number;
    products: string[];
    systemOperation?: string;
    floodEvery: number;
    floodDuration: number;
    floodTiles: string[];
  };
  setup: Entity[];
  help: string;
  presentation: {
    background: string;
    floodColor: string;
    sounds?: Record<string, { frequency: number; duration: number }>;
  };
  privateData?: Record<string, string>;
}
export interface Decision {
  id: string;
  owner: string;
  kind: "production" | "departure" | "capacity";
  actor: string;
  queen?: string;
  options: { id: string; label: string; command: any }[];
}
export interface Core {
  participants: Record<string, { id: string; kind: "player" | "system" }>;
  entities: Record<string, Entity>;
  owners: Record<string, string>;
  slots: string[];
  index: number;
  ap: number;
  round: number;
  clocks: Record<string, number>;
  phase: "action" | "capacity" | "pollen";
  eligible: string[];
  score: Record<string, number>;
  rng: number;
  allocator: number;
  effects: { tile: string; expires: number; source: string }[];
  winner: string | null;
  decision: Decision | null;
}
export interface Event {
  seq: number;
  revision: number;
  transaction: number;
  type: string;
  data: any;
  audience?: string;
}
export interface Match {
  schema: 1;
  id: string;
  packageDigest: string;
  revision: number;
  core: Core;
  pending: Core | null;
  undo: Core[];
  events: Event[];
  inputs: { actor: string; command: any }[];
  initial: {
    seed: number;
    owners: Record<string, string>;
    controllers: Record<string, "human" | "bot" | "external">;
  };
  network: boolean;
  controllers: Record<string, "human" | "bot" | "external">;
}
export interface Envelope {
  matchId: string;
  requestId: string;
  revision: number;
  command: any;
}
export const copy = <T>(v: T): T => structuredClone(v);
export class RuleError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
