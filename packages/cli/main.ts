import { verifySources } from "../../scripts/module-identities.ts";
verifySources();
import { preview } from "../modkit/preview.ts";
import { writeFileSync } from "node:fs";
import {
  catalog,
  Workspace,
  load,
  validate,
  pack,
  simulate,
} from "../modkit/index.ts";
const [op, name, arg] = process.argv.slice(2),
  w = new Workspace(".runtime/mods");
try {
  if (op === "list")
    console.log(
      JSON.stringify(catalog().map((p) => ({ id: p.id, name: p.name }))),
    );
  else if (op === "create")
    console.log(
      JSON.stringify(
        w.create(
          name,
          arg
            ? (catalog().find((p) => p.id === arg) ??
                (() => {
                  throw Error("Unknown template");
                })())
            : catalog()[0],
        ),
      ),
    );
  else if (op === "validate") console.log(JSON.stringify(validate(load(name))));
  else if (op === "simulate")
    console.log(
      JSON.stringify(
        (({ match, ...r }) => r)(simulate(load(name), Number(arg) || 500)),
      ),
    );
  else if (op === "preview")
    console.log(JSON.stringify(await preview(load(name))));
  else if (op === "pack") {
    const p = load(name);
    writeFileSync(arg ?? p.id + ".hexmod", pack(p));
    console.log("Packed " + p.id);
  } else
    console.log(
      "Commands: list | create NAME | validate PATH | simulate PATH [LIMIT] | pack PATH [OUTPUT]",
    );
} catch (e) {
  console.error(String(e));
  process.exitCode = 1;
}
