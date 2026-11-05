import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
test("common runtime/host/client/modkit have no game implementation imports or rule branches", () => {
  for (const dir of ["engine", "host", "client", "modkit"]) {
    for (const file of readdirSync("packages/" + dir).filter(
      (f) => f.endsWith(".ts") && f !== "local-catalog.ts",
    )) {
      const source = readFileSync("packages/" + dir + "/" + file, "utf8");
      assert(!/from\s*["'][^"']*games\//.test(source), dir + "/" + file);
      assert(
        !/\b(pollen|queen|honey|flower|floodEvery|production)\b/i.test(source),
        dir + "/" + file,
      );
    }
  }
});
