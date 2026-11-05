import type {
  GamePackage,
  GameModule,
  Match,
  Command,
  Observation,
  Controllers,
} from "../../packages/engine/types.ts";
import { copy, RuleError } from "../../packages/engine/types.ts";
import { hash, emit, id } from "../../packages/engine/services.ts";
import { identities } from "../../packages/composition/identities.ts";
export interface OutpostPackage extends GamePackage {
  rules: {
    initialFuel: number;
    fuelCap: number;
    income: number;
    ap: number;
    roundLimit: number;
    maxScouts: number;
  };
  bases: Record<string, string>;
  setup: { id: string; side: string; tile: string }[];
}
export interface OutpostState {
  players: string[];
  index: number;
  round: number;
  ap: number;
  fuel: Record<string, number>;
  bases: Record<string, string>;
  entities: Record<string, { id: string; owner: string; tile: string }>;
  outcome: { winners: string[]; reason: string } | null;
}
const turn = (s: Match<OutpostState>) => s.core.players[s.core.index];
function begin(p: OutpostPackage, s: Match<OutpostState>) {
  const who = turn(s);
  s.core.ap = p.rules.ap;
  s.core.fuel[who] = Math.min(
    p.rules.fuelCap,
    s.core.fuel[who] + p.rules.income,
  );
  emit(s, "activation.started", { player: who });
}
export const outpostModule: GameModule<OutpostPackage, OutpostState> = {
  identity: identities["outpost-capture"],
  stateSchema: 1,
  setup: {
    minPlayers: 2,
    maxPlayers: 2,
    areaLabel: "Side",
    allowUnused: false,
  },
  validatePackage(raw) {
    const p = raw as OutpostPackage;
    const errors: string[] = [];
    if (
      !p.rules ||
      ![
        "initialFuel",
        "fuelCap",
        "income",
        "ap",
        "roundLimit",
        "maxScouts",
      ].every(
        (k) =>
          Number.isInteger(p.rules[k]) && p.rules[k] >= 1 && p.rules[k] <= 100,
      ) ||
      p.rules.initialFuel > p.rules.fuelCap
    )
      errors.push("rules: invalid Outpost allowances");
    if (
      !p.bases ||
      Object.keys(p.bases).length !== 2 ||
      !Object.entries(p.bases).every(
        ([a, t]) =>
          p.areas.some((x) => x.id === a && !x.shared) &&
          p.tiles.some((x) => x.id === t),
      ) ||
      new Set(Object.values(p.bases)).size !== 2
    )
      errors.push("bases: two distinct valid bases required");
    if (
      !Array.isArray(p.setup) ||
      p.setup.length !== 2 ||
      new Set(p.setup.map((e) => e.side)).size !== 2 ||
      new Set(p.setup.map((e) => e.id)).size !== 2 ||
      new Set(p.setup.map((e) => e.tile)).size !== 2 ||
      p.setup.some(
        (e) =>
          !p.bases?.[e.side] ||
          !p.tiles.some((t) => t.id === e.tile) ||
          !/^[a-zA-Z0-9_-]+$/.test(e.id),
      )
    )
      errors.push("setup: two unique scouts required");
    const allowed = [
      "schema",
      "id",
      "name",
      "version",
      "engine",
      "author",
      "description",
      "license",
      "module",
      "dependencies",
      "capabilities",
      "tiles",
      "areas",
      "help",
      "presentation",
      "rules",
      "bases",
      "setup",
    ];
    if (Object.keys(p).some((k) => !allowed.includes(k)))
      errors.push("package: unsupported field");
    return errors;
  },
  initialize(p, s, owners) {
    const sides = Object.keys(p.bases);
    if (
      Object.keys(owners).length !== 2 ||
      sides.some((a) => !owners[a]) ||
      new Set(Object.values(owners)).size !== 2
    )
      throw Error("Assign exactly two distinct players to the two sides");
    const players = sides.map((a) => owners[a]);
    const core: OutpostState = {
      players,
      index: 0,
      round: 1,
      ap: 0,
      fuel: Object.fromEntries(players.map((x) => [x, p.rules.initialFuel])),
      bases: Object.fromEntries(sides.map((a) => [owners[a], p.bases[a]])),
      entities: Object.fromEntries(
        p.setup.map((e) => [
          e.id,
          { id: e.id, owner: owners[e.side], tile: e.tile },
        ]),
      ),
      outcome: null,
    };
    s.core = core;
    begin(p, s);
  },
  validateState(p, s) {
    if (
      !s ||
      s.players?.length !== 2 ||
      new Set(s.players).size !== 2 ||
      ![0, 1].includes(s.index) ||
      !Number.isInteger(s.round) ||
      s.round < 1 ||
      s.round > p.rules.roundLimit ||
      !Number.isInteger(s.ap) ||
      s.ap < 0 ||
      s.ap > p.rules.ap
    )
      throw Error("Invalid turn");
    if (
      !s.entities ||
      !s.fuel ||
      !s.bases ||
      s.players.some(
        (w) =>
          !Number.isInteger(s.fuel[w]) ||
          s.fuel[w] < 0 ||
          s.fuel[w] > p.rules.fuelCap ||
          !p.tiles.some((t) => t.id === s.bases[w]),
      )
    )
      throw Error("Invalid resources/bases");
    if (
      new Set(Object.values(s.entities).map((e) => e.tile)).size !==
        Object.keys(s.entities).length ||
      Object.entries(s.entities).some(
        ([k, e]) =>
          e.id !== k ||
          !s.players.includes(e.owner) ||
          !p.tiles.some((t) => t.id === e.tile),
      ) ||
      s.players.some(
        (w) =>
          Object.values(s.entities).filter((e) => e.owner === w).length >
          p.rules.maxScouts,
      )
    )
      throw Error("Invalid scouts");
    if (
      s.outcome &&
      (!Array.isArray(s.outcome.winners) ||
        s.outcome.winners.some((w) => !s.players.includes(w)) ||
        !["base-claimed", "round-limit"].includes(s.outcome.reason))
    )
      throw Error("Invalid outcome");
  },
  actions(p, s, who) {
    const c = s.core;
    if (c.outcome || who !== turn(s)) return [];
    const out: Command[] = [{ type: "end" }];
    for (const e of Object.values(c.entities).filter((e) => e.owner === who)) {
      if (c.ap >= 1 && c.fuel[who] >= 1)
        for (const to of p.tiles.find((t) => t.id === e.tile)!.edges)
          if (to && !Object.values(c.entities).some((x) => x.tile === to))
            out.push({ type: "move", actor: e.id, route: [to] });
      if (
        c.ap >= 1 &&
        Object.entries(c.bases).some(([w, t]) => w !== who && t === e.tile)
      )
        out.push({ type: "claim", actor: e.id });
    }
    if (
      c.ap >= 2 &&
      c.fuel[who] >= 3 &&
      Object.values(c.entities).filter((e) => e.owner === who).length <
        p.rules.maxScouts &&
      !Object.values(c.entities).some((e) => e.tile === c.bases[who])
    )
      out.push({ type: "deploy" });
    return out;
  },
  apply(p, s, command) {
    const c = s.core,
      who = turn(s);
    switch (command.type) {
      case "move": {
        const e = c.entities[String(command.actor)],
          from = e.tile;
        e.tile = (command.route as string[])[0];
        c.ap--;
        c.fuel[who]--;
        emit(s, "entity.moved", { entity: e.id, from, to: e.tile });
        break;
      }
      case "deploy": {
        const key = id(s);
        c.entities[key] = { id: key, owner: who, tile: c.bases[who] };
        c.ap -= 2;
        c.fuel[who] -= 3;
        emit(s, "entity.deployed", { entity: key });
        break;
      }
      case "claim":
        c.ap--;
        c.outcome = { winners: [who], reason: "base-claimed" };
        emit(s, "outcome.declared", { winner: who });
        break;
      case "end":
        if (c.index === 1 && c.round === p.rules.roundLimit) {
          c.outcome = { winners: [], reason: "round-limit" };
          emit(s, "outcome.declared", { draw: true });
          break;
        }
        c.index = 1 - c.index;
        if (c.index === 0) c.round++;
        begin(p, s);
        break;
      default:
        throw new RuleError("INVALID_ACTION", "Unknown Outpost action");
    }
  },
  signals(p, s) {
    return { turn: turn(s), decision: null, outcome: s.core.outcome };
  },
  observe(p, s, who) {
    const c = s.core,
      active = turn(s),
      legal = this.actions(p, s, who);
    return {
      id: s.id,
      revision: s.revision,
      packageDigest: s.packageDigest,
      turn: active,
      outcome: c.outcome,
      status:
        (c.outcome
          ? c.outcome.winners.length
            ? "Winner " + c.outcome.winners.join(", ")
            : "Draw · Round limit"
          : "Player " + active + " · " + c.ap + " AP · Round " + c.round) +
        " · " +
        c.players.map((w) => w + " Fuel " + c.fuel[w]).join(" | "),
      entities: Object.fromEntries(
        Object.values(c.entities).map((e) => [e.id, { ...e, symbol: "▲" }]),
      ),
      tiles: p.tiles,
      tileColors: Object.fromEntries(
        p.tiles.map((t) => [
          t.id,
          t.id === c.bases.p1
            ? "#2f6f91"
            : t.id === c.bases.p2
              ? "#914b55"
              : "#22364c",
        ]),
      ),
      focusTiles: [c.bases[active]],
      controls: legal.map((a) => ({
        command: a,
        label:
          a.type === "end"
            ? "End activation"
            : a.type === "deploy"
              ? "Deploy Scout (2 AP, 3 Fuel)"
              : a.type === "claim"
                ? "Claim opposing base (1 AP)"
                : (a.route as string[]).join(" → "),
        kind: a.type === "move" ? "route" : "button",
        actor: a.actor as string,
        route: a.route as string[],
        primary: a.type === "end",
      })),
      actions: legal,
      decision: null,
      canUndo: false,
      events: [],
      labels: { select: "Select Scout", focus: "Focus base" },
      // Public observation only: policy uses these declared public fields, never authority internals.
      bases: copy(c.bases),
      fuel: copy(c.fuel),
    } as Observation;
  },
  policy(p, o) {
    const claim = o.actions.find((a) => a.type === "claim");
    if (claim) return claim;
    const bases = (o as Observation & { bases: Record<string, string> }).bases;
    const target = Object.entries(bases).find(([w]) => w !== o.turn)![1];
    const occupied = new Set(Object.values(o.entities).map((e) => e.tile));
    const distances = new Map<string, number>([[target, 0]]),
      queue = [target];
    for (let i = 0; i < queue.length; i++)
      for (const t of p.tiles.find((t) => t.id === queue[i])!.edges)
        if (
          t &&
          !distances.has(t) &&
          (!occupied.has(t) ||
            Object.values(o.entities).some(
              (e) => e.tile === t && e.owner === o.turn,
            ))
        ) {
          distances.set(t, distances.get(queue[i])! + 1);
          queue.push(t);
        }
    const moves = o.actions
      .filter((a) => a.type === "move")
      .filter(
        (a) =>
          (distances.get((a.route as string[])[0]) ?? 999) <
          (distances.get(o.entities[String(a.actor)].tile) ?? 999),
      );
    moves.sort(
      (a, b) =>
        (distances.get((a.route as string[])[0]) ?? 999) -
          (distances.get((b.route as string[])[0]) ?? 999) ||
        JSON.stringify(a).localeCompare(JSON.stringify(b)),
    );
    return moves[0] ?? o.actions.find((a) => a.type === "end") ?? null;
  },
};
