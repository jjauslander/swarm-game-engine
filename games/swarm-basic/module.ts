import { createOperations } from "./extensions.ts";
import type {
  GameModule,
  Observation,
  Command,
} from "../../packages/engine/types.ts";
import type { GamePackage, Core, Match } from "./types.ts";
import { copy } from "./types.ts";
import {
  initialize,
  apply,
  actions,
  active,
  decisionOwner,
  population,
  support,
} from "./rules.ts";
import { validate } from "./validation.ts";
import { choose } from "./bot.ts";
import { identities } from "../../packages/composition/identities.ts";
function legacyView(p: GamePackage, s: Match, who: string) {
  const d = s.core.decision;
  return {
    id: s.id,
    revision: s.revision,
    packageDigest: s.packageDigest,
    entities: copy(s.core.entities),
    owners: copy(s.core.owners),
    active: active(s),
    ap: s.core.ap,
    round: s.core.round,
    score: copy(s.core.score),
    phase: s.core.phase,
    areas: Object.fromEntries(
      s.core.slots.map((a) => [
        a,
        {
          population: population(p, s, a),
          support: support(p, s, a),
          clock: s.core.clocks[a] ?? 0,
        },
      ]),
    ),
    winner: s.core.winner,
    effects: copy(s.core.effects),
    decision: d
      ? {
          id: d.id,
          kind: d.kind,
          owner: d.owner,
          actor: d.actor,
          options:
            d.owner === who
              ? copy(d.options).map(({ id, label }) => ({ id, label }))
              : [],
        }
      : null,
    actions: actions(p, s, who),
    canUndo:
      !s.network &&
      !p.privateData &&
      !d &&
      s.undo.length > 0 &&
      decisionOwner(s) === who,
    privateData: p.privateData?.[who] ?? null,
    events: s.events
      .filter((e) => !e.audience || e.audience === who)
      .slice(-100),
  };
}

export function createSwarmModule(
  operations = createOperations(),
): GameModule<GamePackage, Core> {
  return {
    identity: identities["swarm-basic"],
    stateSchema: 1,
    setup: {
      minPlayers: 2,
      maxPlayers: 6,
      areaLabel: "Hive",
      allowUnused: true,
    },
    validatePackage: (p) => validate(p, operations),
    validateState(p, s) {
      if (
        !s ||
        !s.entities ||
        !s.owners ||
        !s.slots?.length ||
        !s.slots[s.index] ||
        !Number.isInteger(s.ap) ||
        s.ap < 0 ||
        !Number.isInteger(s.round) ||
        s.round < 1
      )
        throw Error("Invalid Swarm state");
      for (const [key, e] of Object.entries(s.entities)) {
        if (
          key !== e.id ||
          !p.types[e.type] ||
          !p.tiles.some((t) => t.id === e.tile) ||
          !p.areas.some((a) => a.id === e.origin) ||
          !Number.isInteger(e.pollen) ||
          e.pollen < 0 ||
          e.pollen > p.types[e.type].cargo ||
          (e.carrier && !s.entities[e.carrier])
        )
          throw Error("Invalid Swarm entity");
      }
      const d = s.decision;
      if (
        d &&
        (!d.id ||
          !s.participants[d.owner] ||
          !["production", "departure", "capacity"].includes(d.kind) ||
          !d.options.length ||
          new Set(d.options.map((o) => o.id)).size !== d.options.length ||
          d.options.some((o) => !o.command?.type) ||
          (d.kind !== "capacity" && !s.entities[d.actor]) ||
          (d.kind === "production" && !s.entities[d.queen!]))
      )
        throw Error("Invalid Swarm continuation");
    },
    initialize,
    actions,
    apply: (p, s, c) => apply(p, s, c, operations),
    signals(p, s) {
      return {
        turn: s.core.owners[active(s)],
        decision: s.core.decision
          ? {
              ...s.core.decision,
              options: s.core.decision.options.map((o) => ({
                ...o,
                command: {
                  type: "respond",
                  decision: s.core.decision!.id,
                  option: o.id,
                },
              })),
            }
          : null,
        outcome: s.core.winner
          ? { winners: [s.core.winner], reason: "production-goal" }
          : null,
      };
    },
    undoAllowed(p, s, c) {
      return c.type !== "end";
    },
    observe(p, s, who) {
      const v = legacyView(p, s, who);
      const visible = p.tiles.filter(
        (t) => p.areas.find((a) => a.id === t.area)?.shared || v.owners[t.area],
      );
      const controls = v.actions.map((c) => ({
        command: c,
        label:
          c.type === "phase"
            ? "Finish Pollen Runs"
            : c.type === "end"
              ? "End activation"
              : c.type === "move"
                ? c.route.join(" → ")
                : c.type + " " + (c.to ?? c.resource ?? ""),
        kind: c.type === "move" ? "route" : "button",
        actor: c.actor,
        route: c.route,
        primary: c.type === "end" || c.type === "phase",
        staged:
          c.type === "move" && p.types[v.entities[c.actor].type].segments === 2,
        previewBadge:
          c.type === "move" &&
          p.tiles.find((t) => t.id === c.route[0])?.terrain === "flower"
            ? String(
                Math.max(
                  v.entities[c.actor].pollen,
                  p.types[v.entities[c.actor].type].cargo -
                    Object.values(v.entities).filter(
                      (e) => e.carrier === c.actor,
                    ).length,
                ),
              )
            : undefined,
      }));
      return {
        ...v,
        decision: null,
        turn: s.core.owners[active(s)],
        outcome: null,
        status:
          (v.winner
            ? "Winner " + v.winner
            : "Hive " + v.active + " · " + v.ap + " AP · Round " + v.round) +
          (v.decision
            ? " · " + v.decision.owner + " chooses " + v.decision.kind
            : "") +
          " · Population " +
          v.areas[v.active].population +
          " / Supports " +
          v.areas[v.active].support +
          " · " +
          Object.entries(v.score)
            .map(([id, n]) => id + ": " + n)
            .join(" | "),
        entities: Object.fromEntries(
          Object.values(v.entities).map((e) => [
            e.id,
            {
              ...e,
              symbol: p.types[e.type].symbol,
              owner: v.owners[e.origin],
              badge: e.pollen ? String(e.pollen) : "",
              hidden: !!e.carrier,
            },
          ]),
        ),
        tiles: visible,
        tileColors: Object.fromEntries(
          visible.map((t) => [
            t.id,
            v.effects.some((f) => f.tile === t.id)
              ? p.presentation.floodColor
              : t.terrain === "flower"
                ? "#d6a14d"
                : t.area === "G"
                  ? "#36523a"
                  : "#614a32",
          ]),
        ),
        focusTiles: visible.filter((t) => t.area === v.active).map((t) => t.id),
        controls,
        labels: { select: "Select bee", focus: "Focus hive" },
      } as Observation;
    },
    policy: choose,
  };
}
export const swarmModule = createSwarmModule();
