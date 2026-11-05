import type {
  GameModule,
  GamePackage,
  ModuleIdentity,
  Decision,
  Outcome,
  Observation,
} from "../../packages/engine/types.ts";
import { emit, id, random } from "../../packages/engine/services.ts";
export interface RelayPackage extends GamePackage {
  rules: { target: number };
}
export interface RelayState {
  active: string;
  charge: Record<string, number>;
  choice: Decision | null;
  result: Outcome | null;
}
export function createRelayModule(
  identity: ModuleIdentity,
): GameModule<RelayPackage, RelayState> {
  return {
    identity,
    stateSchema: 1,
    setup: {
      minPlayers: 2,
      maxPlayers: 2,
      areaLabel: "Relay",
      allowUnused: false,
    },
    validatePackage(value) {
      const p = value as RelayPackage;
      return Number.isInteger(p.rules?.target) &&
        p.rules.target >= 2 &&
        p.rules.target <= 20
        ? []
        : ["rules.target: expected 2–20"];
    },
    validateState(p, s) {
      if (
        !s ||
        !["p1", "p2"].includes(s.active) ||
        !s.charge ||
        ["p1", "p2"].some(
          (w) => !Number.isInteger(s.charge[w]) || s.charge[w] < 0,
        )
      )
        throw Error("Invalid charge");
      if (
        s.choice &&
        (s.choice.kind !== "signal-response" ||
          s.choice.owner === s.active ||
          s.choice.options.map((o) => o.id).join(",") !== "accept,reflect")
      )
        throw Error("Invalid continuation");
    },
    initialize(p, s, owners) {
      if (
        Object.keys(owners).length !== 2 ||
        !Object.values(owners).includes("p1") ||
        !Object.values(owners).includes("p2")
      )
        throw Error("Two relay players required");
      s.core = {
        active: "p1",
        charge: { p1: 2, p2: 0 },
        choice: null,
        result: null,
      };
    },
    actions(p, s, who) {
      const c = s.core;
      if (c.result) return [];
      if (c.choice)
        return c.choice.owner === who
          ? c.choice.options.map((o) => o.command)
          : [];
      if (who !== c.active) return [];
      return [
        { type: "recharge" },
        ...(c.charge[who] >= 1 ? [{ type: "transmit" }] : []),
      ];
    },
    apply(p, s, command) {
      const c = s.core,
        other = c.active === "p1" ? "p2" : "p1";
      if (command.type === "recharge") {
        c.charge[c.active]++;
        c.active = other;
        emit(s, "signal.recharged", {});
        return;
      }
      if (command.type === "transmit") {
        c.charge[c.active]--;
        const key = id(s);
        c.choice = {
          id: key,
          owner: other,
          kind: "signal-response",
          options: ["accept", "reflect"].map((option) => ({
            id: option,
            label: option === "accept" ? "Accept signal" : "Reflect signal",
            command: { type: "respond", decision: key, option },
          })),
        };
        emit(
          s,
          "signal.private",
          { nonce: Math.floor(random(s) * 1000000) },
          other,
        );
        return;
      }
      if (command.type === "respond") {
        if (command.option === "accept") c.charge[other] += 2;
        c.choice = null;
        c.active = other;
        if (c.charge[other] >= p.rules.target)
          c.result = { winners: [other], reason: "relay-charged" };
      }
    },
    signals(p, s) {
      return {
        turn: s.core.active,
        decision: s.core.choice,
        outcome: s.core.result,
      };
    },
    observe(p, s, who) {
      const actions = this.actions(p, s, who);
      return {
        id: s.id,
        revision: s.revision,
        packageDigest: s.packageDigest,
        turn: s.core.active,
        outcome: s.core.result,
        status:
          "Relay charge " +
          Object.entries(s.core.charge)
            .map(([w, n]) => w + ": " + n)
            .join(" | "),
        entities: {},
        tiles: p.tiles,
        tileColors: Object.fromEntries(p.tiles.map((t) => [t.id, "#345060"])),
        focusTiles: p.tiles.map((t) => t.id),
        controls: s.core.choice
          ? []
          : actions.map((c) => ({ command: c, label: c.type, kind: "button" })),
        actions,
        decision: null,
        canUndo: false,
        events: [],
        labels: { select: "Select relay", focus: "Focus board" },
      } as Observation;
    },
  };
}
