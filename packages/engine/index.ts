import { validateBase } from "./validation.ts";
import { copy, RuleError } from "./types.ts";
import type {
  GamePackage,
  GameModule,
  Match,
  Controllers,
  Command,
  Observation,
  Checkpoint,
} from "./types.ts";
import { stable, hash, emit, assertJson } from "./services.ts";
export * from "./types.ts";
export * from "./services.ts";
export const decisionOwner = (s: Match) => s.decision?.owner ?? s.turn;
const checkpoint = <S>(s: Match<S>): Checkpoint<S> =>
  copy({
    core: s.core,
    rng: s.rng,
    allocator: s.allocator,
    turn: s.turn,
    decision: s.decision,
    outcome: s.outcome,
  });
/** Each runtime has its own explicit registry; generic runtime imports no games. */
function validateSignals(s: Match) {
  if (!Object.hasOwn(s.controllers, s.turn))
    throw Error("Invalid active participant");
  const d = s.decision;
  if (
    d &&
    (!d.id ||
      typeof d.kind !== "string" ||
      !Object.hasOwn(s.controllers, d.owner) ||
      !Array.isArray(d.options) ||
      !d.options.length ||
      d.options.length > 20000 ||
      new Set(d.options.map((o) => o.id)).size !== d.options.length ||
      d.options.some(
        (o) =>
          typeof o.id !== "string" ||
          typeof o.label !== "string" ||
          !o.command?.type,
      ))
  )
    throw Error("Invalid decision");
  if (
    s.outcome &&
    (!Array.isArray(s.outcome.winners) ||
      new Set(s.outcome.winners).size !== s.outcome.winners.length ||
      s.outcome.winners.some((w) => !Object.hasOwn(s.controllers, w)) ||
      typeof s.outcome.reason !== "string")
  )
    throw Error("Invalid outcome");
}
function validateObservation(o: Observation) {
  if (
    typeof o.status !== "string" ||
    !Array.isArray(o.tiles) ||
    !o.entities ||
    !o.tileColors ||
    !Array.isArray(o.focusTiles) ||
    !Array.isArray(o.controls) ||
    typeof o.labels?.select !== "string" ||
    typeof o.labels?.focus !== "string"
  )
    throw Error("Invalid observation");
  const tiles = new Set(o.tiles.map((t) => t.id));
  if (
    Object.values(o.entities).some(
      (e) =>
        typeof e.symbol !== "string" ||
        typeof e.owner !== "string" ||
        !tiles.has(e.tile),
    ) ||
    o.focusTiles.some((t) => !tiles.has(t))
  )
    throw Error("Invalid projected location");
  for (const c of o.controls)
    if (
      typeof c.label !== "string" ||
      !["button", "route"].includes(c.kind) ||
      !o.actions.some((a) => stable(a) === stable(c.command)) ||
      (c.kind === "route" &&
        (!c.actor ||
          !o.entities[c.actor] ||
          !Array.isArray(c.route) ||
          !c.route.length ||
          c.route.some((t) => !tiles.has(t))))
    )
      throw Error("Invalid control descriptor");
}
export class Runtime {
  private modules = new Map<string, GameModule>();
  register<P extends GamePackage, S>(module: GameModule<P, S>) {
    if (
      module.identity.api !== 1 ||
      this.modules.has(module.identity.id) ||
      !/^[a-f0-9]{64}$/.test(module.identity.digest)
    )
      throw Error("Duplicate/invalid module identity or API");
    this.modules.set(module.identity.id, module as unknown as GameModule);
    return this;
  }
  resolve<P extends GamePackage, S = object>(p: P): GameModule<P, S> {
    const m = this.modules.get(p.module?.id);
    if (!m || stable(m.identity) !== stable(p.module))
      throw Error(
        "Install the exact trusted module build: " +
          (p.module?.id ?? "missing"),
      );
    return m as unknown as GameModule<P, S>;
  }
  validate(p: unknown): string[] {
    try {
      assertJson(p);
      const pkg = p as GamePackage;
      if (pkg?.schema !== 2 || pkg.engine !== "2")
        return [
          "Unsupported package schema; use the original engine revision for schema-1 packages",
        ];
      const base = validateBase(pkg);
      return base.length ? base : this.resolve(pkg).validatePackage(pkg);
    } catch (e) {
      return [(e as Error).message];
    }
  }
  create<P extends GamePackage, S = object>(
    p: P,
    digest: string,
    owners: Record<string, string>,
    seed = 12345,
    network = false,
    controllers: Controllers = {},
  ): Match<S> {
    const errors = this.validate(p);
    if (errors.length) throw Error(errors.join("\n"));
    const players = [...new Set(Object.values(owners))];
    if (
      players.some((x) => !/^p[1-6]$/.test(x)) ||
      Object.entries(controllers).some(
        ([id, c]) =>
          !players.includes(id) || !["human", "bot", "external"].includes(c),
      )
    )
      throw Error("Invalid controllers/participants");
    const configured = Object.fromEntries(
      players.map((id) => [id, controllers[id] ?? "human"]),
    ) as Controllers;
    const m = this.resolve<P, S>(p);
    const s: Match<S> = {
      schema: 2,
      id: "match-" + hash({ digest, owners, seed }),
      packageDigest: digest,
      module: copy(p.module),
      revision: 0,
      core: undefined as S,
      rng: seed >>> 0 || 1,
      allocator: 1000,
      turn: "",
      decision: null,
      outcome: null,
      pending: null,
      undo: [],
      events: [],
      inputs: [],
      initial: { seed, owners: copy(owners), controllers: copy(configured) },
      network,
      controllers: copy(configured),
    };
    m.initialize(copy(p), s, copy(owners));
    Object.assign(s, m.signals(copy(p), copy(s)));
    validateSignals(s);
    m.validateState(p, s.core);
    assertJson(s);
    return s;
  }
  actions<P extends GamePackage, S>(p: P, s: Match<S>, who: string): Command[] {
    if (s.outcome || who !== decisionOwner(s)) return [];
    try {
      return copy(
        this.resolve<P, S>(p).actions(
          copy(p),
          copy({ ...s, events: [], inputs: [], undo: [], pending: null }),
          who,
        ),
      );
    } catch {
      throw new RuleError("RULE_QUERY", "Rule query failed; state unchanged");
    }
  }
  submit<P extends GamePackage, S>(
    p: P,
    s: Match<S>,
    who: string,
    envelope: { matchId: string; revision: number; command: Command },
  ): Match<S> {
    const m = this.resolve<P, S>(p),
      c = envelope.command;
    if (stable(s.module) !== stable(p.module))
      throw Error("Module identity mismatch");
    if (envelope.matchId !== s.id || envelope.revision !== s.revision)
      throw new RuleError("STALE_STATE", "Refresh this match before acting");
    assertJson(c);
    if (!c || typeof c.type !== "string")
      throw Error("Invalid action envelope");
    const n = copy(s);
    if (c.type === "undo") {
      if (
        s.network ||
        p.privateData ||
        s.decision ||
        !s.undo.length ||
        who !== decisionOwner(s)
      )
        throw Error("Undo unavailable");
      Object.assign(n, n.undo.pop()!);
      n.pending = null;
      emit(n, "history.undone", {});
    } else {
      if (!this.actions(p, s, who).some((x) => stable(x) === stable(c)))
        throw new RuleError("INVALID_ACTION", "Choose a current legal action");
      if (!n.pending) n.pending = checkpoint(n);
      // Treat a rule exception as an atomic rejection; diagnostic contains no private state.
      try {
        m.apply(copy(p), n, copy(c));
        m.validateState(p, n.core);
        assertJson(n.core);
        Object.assign(n, m.signals(copy(p), copy(n)));
        validateSignals(n);
      } catch (e) {
        if (e instanceof RuleError && e.code === "WORK_LIMIT") throw e;
        throw new RuleError(
          "RULE_FAILURE",
          "Rule resolution failed; state unchanged",
        );
      }
      if (n.decision) n.outcome = null;
      else if (n.pending) {
        if (m.undoAllowed?.(p, n, c) !== false) n.undo.push(n.pending);
        else n.undo = [];
        n.undo = n.undo.slice(-30);
        n.pending = null;
      }
    }
    n.revision++;
    n.inputs.push({ actor: who, command: copy(c) });
    assertJson(n);
    return n;
  }
  view<P extends GamePackage, S>(p: P, s: Match<S>, who: string): Observation {
    const m = this.resolve<P, S>(p);
    let o: Observation;
    try {
      o = m.observe(
        copy(p),
        copy({ ...s, events: [], inputs: [], undo: [], pending: null }),
        who,
      );
    } catch {
      throw new RuleError("RULE_VIEW", "Observation unavailable");
    }
    o.id = s.id;
    o.revision = s.revision;
    o.packageDigest = s.packageDigest;
    o.turn = s.turn;
    o.outcome = copy(s.outcome);
    o.actions = this.actions(p, s, who);
    o.decision = s.decision
      ? copy({
          ...s.decision,
          options: s.decision.owner === who ? s.decision.options : [],
        })
      : null;
    o.events = copy(
      s.events.filter((e) => !e.audience || e.audience === who).slice(-100),
    );
    o.canUndo =
      !s.network &&
      !p.privateData &&
      !s.decision &&
      s.undo.length > 0 &&
      decisionOwner(s) === who;
    try {
      assertJson(o);
      validateObservation(o);
    } catch {
      throw new RuleError("RULE_VIEW", "Invalid observation descriptor");
    }
    return o;
  }
  choose<P extends GamePackage, S>(p: P, s: Match<S>) {
    const o = this.view(p, s, decisionOwner(s)),
      m = this.resolve<P, S>(p);
    const publicDefinition = copy(p);
    delete publicDefinition.privateData;
    const c = m.policy?.(publicDefinition, copy(o)) ?? o.actions[0] ?? null;
    return c && o.actions.some((a) => stable(a) === stable(c))
      ? c
      : (o.actions[0] ?? null);
  }
  snapshot<P extends GamePackage, S>(p: P, s: Match<S>) {
    this.resolve(p);
    return stable({ schema: 2, packageDigest: s.packageDigest, match: s });
  }
  replay<P extends GamePackage, S>(p: P, s: Match<S>): Match<S> {
    let n = this.create<P, S>(
      p,
      s.packageDigest,
      s.initial.owners,
      s.initial.seed,
      s.network,
      s.initial.controllers,
    );
    n.id = s.id;
    for (const x of s.inputs)
      n = this.submit(p, n, x.actor, {
        matchId: n.id,
        revision: n.revision,
        command: x.command,
      });
    return n;
  }
  restore<P extends GamePackage, S = object>(
    p: P,
    digest: string,
    text: string,
  ): Match<S> {
    if (text.length > 5000000) throw Error("Save too large");
    const data = JSON.parse(text);
    if (data.schema !== 2)
      throw Error(
        "Unsupported save schema; reopen with engine revision 2c6d11c. Original save retained.",
      );
    if (
      data.packageDigest !== digest ||
      data.match?.packageDigest !== digest ||
      stable(data.match.module) !== stable(p.module)
    )
      throw Error("Install exact package and module build");
    this.resolve(p);
    const n = this.replay<P, S>(p, data.match);
    if (stable(n) !== stable(data.match))
      throw Error("Invalid save history/state");
    return n;
  }
}
