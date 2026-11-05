export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };
export type Command = { type: string; [key: string]: Json };
export interface Tile {
  id: string;
  area: string;
  q: number;
  r: number;
  terrain: string;
  edges: (string | null)[];
}
export interface ModuleIdentity {
  id: string;
  version: string;
  api: 1;
  digest: string;
}
export interface GamePackage {
  schema: 2;
  id: string;
  name: string;
  version: string;
  engine: string;
  author: string;
  description: string;
  license: string;
  module: ModuleIdentity;
  dependencies: { id: string; version: string; digest: string }[];
  capabilities: string[];
  tiles: Tile[];
  areas: { id: string; shared: boolean }[];
  help: string;
  presentation: {
    background: string;
    sounds?: Record<string, { frequency: number; duration: number }>;
  };
  privateData?: Record<string, string>;
}
export interface Choice {
  id: string;
  label: string;
  command: Command;
  target?: string;
}
export interface Decision {
  id: string;
  owner: string;
  kind: string;
  options: Choice[];
}
export interface Outcome {
  winners: string[];
  reason: string;
}
export interface Event {
  seq: number;
  revision: number;
  transaction: number;
  type: string;
  data: Json;
  audience?: string;
}
export type Controllers = Record<string, "human" | "bot" | "external">;
export interface Checkpoint<S> {
  core: S;
  rng: number;
  allocator: number;
  turn: string;
  decision: Decision | null;
  outcome: Outcome | null;
}
export interface Match<S = unknown> extends Checkpoint<S> {
  schema: 2;
  id: string;
  packageDigest: string;
  module: ModuleIdentity;
  revision: number;
  pending: Checkpoint<S> | null;
  undo: Checkpoint<S>[];
  events: Event[];
  inputs: { actor: string; command: Command }[];
  initial: {
    seed: number;
    owners: Record<string, string>;
    controllers: Controllers;
  };
  network: boolean;
  controllers: Controllers;
}
export interface Control {
  command: Command;
  label: string;
  kind: "route" | "button";
  actor?: string;
  route?: string[];
  staged?: boolean;
  primary?: boolean;
  previewBadge?: string;
}
export interface ViewEntity {
  id: string;
  tile: string;
  symbol: string;
  owner: string;
  badge?: string;
  hidden?: boolean;
}
export interface Observation {
  id: string;
  revision: number;
  packageDigest: string;
  turn: string;
  outcome: Outcome | null;
  status: string;
  entities: Record<string, ViewEntity>;
  tiles: Tile[];
  tileColors: Record<string, string>;
  focusTiles: string[];
  controls: Control[];
  actions: Command[];
  decision: Decision | null;
  canUndo: boolean;
  events: Event[];
  labels: { select: string; focus: string };
}
export interface SetupDescriptor {
  minPlayers: number;
  maxPlayers: number;
  areaLabel: string;
  allowUnused: boolean;
}
export interface GameModule<P extends GamePackage = GamePackage, S = object> {
  identity: ModuleIdentity;
  stateSchema: number;
  setup: SetupDescriptor;
  validatePackage(p: unknown): string[];
  validateState(p: P, s: S): void;
  initialize(p: P, draft: Match<S>, owners: Record<string, string>): void;
  actions(p: P, s: Match<S>, who: string): Command[];
  apply(p: P, draft: Match<S>, command: Command): void;
  signals(
    p: P,
    s: Match<S>,
  ): { turn: string; decision: Decision | null; outcome: Outcome | null };
  observe(p: P, s: Match<S>, who: string): Observation;
  policy?(p: P, observation: Observation): Command | null;
  undoAllowed?(p: P, s: Match<S>, command: Command): boolean;
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
