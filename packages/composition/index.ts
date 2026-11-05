/** Explicit application composition root. Game imports belong only here. */
import { Runtime } from "../engine/index.ts";
import { swarmModule } from "../../games/swarm-basic/module.ts";
import { outpostModule } from "../../games/outpost-capture/module.ts";
export const runtime = new Runtime()
  .register(swarmModule)
  .register(outpostModule);
export const create = runtime.create.bind(runtime),
  actions = runtime.actions.bind(runtime),
  submit = runtime.submit.bind(runtime),
  view = runtime.view.bind(runtime),
  snapshot = runtime.snapshot.bind(runtime),
  restore = runtime.restore.bind(runtime),
  replay = runtime.replay.bind(runtime),
  choose = runtime.choose.bind(runtime);
export const validate = runtime.validate.bind(runtime);
export { decisionOwner, copy, stable, hash, tile } from "../engine/index.ts";
import { unpack as decode } from "../engine/package.ts";
export const unpack = (bytes: Uint8Array) => decode(bytes, validate);
export const capabilities = [
  "hex",
  "decisions",
  "effects",
  "private-observation",
  "trusted-modules",
];

export const defaultPackageId = "swarm-basic-prototype";
