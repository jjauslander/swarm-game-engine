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
  schema: 2;
  module: { id: string; api: 1; version: string; digest: string };
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
  options: { id: string; label: string; command: any; target?: string }[];
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

export type Match = import("../../packages/engine/types.ts").Match<Core>;
export { copy, RuleError } from "../../packages/engine/types.ts";
