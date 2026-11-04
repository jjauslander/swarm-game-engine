import basic from "../../mods/swarm-basic-prototype/package.json";
import garden from "../../mods/garden-cycle/package.json";
import { stable } from "../engine/index.ts";
import { validate, unpack } from "../engine/package.ts";
export { unpack, validate };
export async function identify(p: any) {
  const bytes = new TextEncoder().encode(stable(p));
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return {
    package: p,
    digest: [...new Uint8Array(h)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join(""),
  };
}
export async function localCatalog() {
  const saved = JSON.parse(localStorage.getItem("installedPackages") ?? "[]");
  return Promise.all(
    [basic, garden, ...saved.filter((p) => !validate(p).length)].map(identify),
  );
}
