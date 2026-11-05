import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { load, pack } from "../../packages/modkit/index.ts";
const script = [
  ["p1", "scoutA", "cell5"],
  ["p1", "scoutA", "cell10"],
  ["p1", "scoutA", "cell15"],
  ["p1", "end", ""],
  ["p2", "scoutB", "cell9"],
  ["p2", "scoutB", "cell4"],
  ["p2", "scoutB", "cell0"],
  ["p2", "end", ""],
  ["p1", "scoutA", "cell18"],
  ["p1", "claim", ""],
];
async function act(page: Page, actor: string, to: string) {
  if (actor === "end") {
    await page
      .getByRole("button", { name: "End activation", exact: true })
      .click();
    return;
  }
  if (actor === "claim") {
    await page
      .getByRole("button", { name: "Claim opposing base (1 AP)", exact: true })
      .click();
    return;
  }
  await page.getByLabel("Select Scout").selectOption(actor);
  await page.getByLabel("Movement route").selectOption({ label: to });
  await page
    .getByRole("button", { name: "Move selected route", exact: true })
    .click();
}
for (const width of [1280, 390])
  test(
    "Outpost deploy, undo, save and complete independent rules at " + width,
    async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await page
        .locator("#packages")
        .selectOption({ label: "Outpost Capture" });
      await expect(page.locator("#count")).toBeDisabled();
      await page.locator("#controller1").selectOption("human");
      await page
        .getByRole("button", { name: "Play locally", exact: true })
        .click();
      await expect(page.locator("#status")).toContainText("p1 Fuel 5");
      await page
        .getByRole("button", {
          name: "Deploy Scout (2 AP, 3 Fuel)",
          exact: true,
        })
        .click();
      await expect(page.locator("#status")).toContainText("1 AP");
      await expect(page.locator("#status")).toContainText("p1 Fuel 2");
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await expect(page.locator("#status")).toContainText("3 AP");
      await act(page, "scoutA", "cell5");
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const file = await (await download).path();
      await page.getByRole("button", { name: "Mods", exact: true }).click();
      await page
        .locator("#packages")
        .selectOption({ label: "Outpost Capture" });
      await page.locator("#load").setInputFiles(file!);
      for (const [who, actor, to] of script.slice(1))
        await act(page, actor, to);
      await expect(page.locator("#status")).toContainText("Winner p1");
      await expect(page.getByLabel("Select bee")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath("outpost-" + width + ".png"),
      });
      await page.getByRole("button", { name: "Mods", exact: true }).click();
      await page
        .getByRole("button", { name: "Return to game", exact: true })
        .click();
      await expect(page.locator("#status")).toContainText("Winner p1");
    },
  );
test("Outpost round-limit draw is displayed", async ({ page }) => {
  const p = load("mods/outpost-capture/package.json");
  p.id = "outpost-draw";
  p.name = "Outpost short draw";
  p.rules.roundLimit = 1;
  await page.goto("/");
  await page
    .locator("#import")
    .setInputFiles({
      name: "draw.hexmod",
      mimeType: "application/octet-stream",
      buffer: Buffer.from(pack(p)),
    });
  await page.locator("#packages").selectOption({ label: p.name });
  await page.locator("#controller1").selectOption("human");
  await page.getByRole("button", { name: "Play locally", exact: true }).click();
  await act(page, "end", "");
  await act(page, "end", "");
  await expect(page.locator("#status")).toContainText("Draw");
  await expect(
    page.getByRole("button", { name: "End activation", exact: true }),
  ).toBeDisabled();
});
test("Outpost two browser seats reconnect and complete a full match", async ({
  browser,
  request,
}) => {
  const catalogue = await (
      await request.get("http://127.0.0.1:5174/api/packages")
    ).json(),
    p = catalogue.find((x) => x.package.id === "outpost-capture");
  const match = await (
    await request.post("http://127.0.0.1:5174/api/create", {
      data: { digest: p.digest, owners: { A: "p1", B: "p2" }, seed: 7 },
    })
  ).json();
  const contexts = [await browser.newContext(), await browser.newContext()],
    pages: Record<string, Page> = {};
  try {
    for (let i = 0; i < 2; i++) {
      const page = await contexts[i].newPage(),
        seat = match.seats[i];
      pages[seat.player] = page;
      await page.goto("/");
      await page
        .locator("summary")
        .filter({ hasText: "Join network seat" })
        .click();
      await page
        .locator("#join-data")
        .fill(JSON.stringify({ id: match.id, ...seat, digest: p.digest }));
      await page.getByRole("button", { name: "Join", exact: true }).click();
      await expect(page.locator("canvas")).toBeVisible();
    }
    await pages.p2.reload();
    await pages.p2
      .getByRole("button", { name: "Reconnect last seat", exact: true })
      .click();
    for (const [who, actor, to] of script) {
      await expect(pages[who].locator("#status")).toContainText(
        "Player " + who,
      );
      await act(pages[who], actor, to);
    }
    for (const page of Object.values(pages))
      await expect(page.locator("#status")).toContainText("Winner p1");
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

for (const route of ["cli", "mcp"])
  test(
    route + " authored Outpost archive imports and plays to victory",
    async ({ page }) => {
      const name = "authored-" + route + "-" + process.pid;
      let archive: Buffer;
      if (route === "cli") {
        const cli = (args: string[]) => {
          const r = spawnSync(
            process.execPath,
            ["--import", "tsx", "packages/cli/main.ts", ...args],
            { encoding: "utf8", windowsHide: true },
          );
          expect(r.status, r.stderr).toBe(0);
          return r.stdout;
        };
        cli(["create", name, "outpost-capture"]);
        const path = ".runtime/mods/" + name + "/package.json";
        const p = JSON.parse(readFileSync(path, "utf8"));
        p.rules.income = 3;
        writeFileSync(path, JSON.stringify(p));
        cli(["validate", path]);
        cli(["simulate", path, "100"]);
        cli(["pack", path, ".runtime/" + name + ".hexmod"]);
        archive = readFileSync(".runtime/" + name + ".hexmod");
      } else {
        const child = spawn(
          process.execPath,
          ["--import", "tsx", "packages/mcp/main.ts"],
          {
            env: { ...process.env, SWARM_MOD_WORKSPACE: ".runtime/" + name },
            windowsHide: true,
            stdio: ["pipe", "pipe", "pipe"],
          },
        );
        let buffer = "",
          seq = 0;
        const pending = new Map<number, (r: any) => void>();
        child.stdout.on("data", (b) => {
          buffer += b;
          let i;
          while ((i = buffer.indexOf("\n")) >= 0) {
            const msg = JSON.parse(buffer.slice(0, i));
            buffer = buffer.slice(i + 1);
            pending.get(msg.id)?.(msg);
            pending.delete(msg.id);
          }
        });
        const tool = (name: string, args: any) =>
          new Promise<any>((resolve, reject) => {
            const id = ++seq,
              timeout = setTimeout(() => reject(Error("MCP timeout")), 10000);
            pending.set(id, (msg) => {
              clearTimeout(timeout);
              if (msg.result?.isError)
                reject(Error(msg.result.content[0].text));
              else resolve(JSON.parse(msg.result.content[0].text));
            });
            child.stdin.write(
              JSON.stringify({
                jsonrpc: "2.0",
                id,
                method: "tools/call",
                params: { name, arguments: args },
              }) + "\n",
            );
          });
        try {
          await tool("create_mod", { name, template: "outpost-capture" });
          const p = await tool("read_mod", { name });
          p.rules.income = 3;
          await tool("write_mod", { name, package: p });
          await tool("validate_mod", { name });
          await tool("simulate_mod", { name, limit: 100 });
          archive = Buffer.from(
            (await tool("pack_mod", { name })).archive,
            "base64",
          );
        } finally {
          child.kill();
        }
      }
      await page.goto("/");
      await page
        .locator("#import")
        .setInputFiles({
          name: "authored.hexmod",
          mimeType: "application/octet-stream",
          buffer: archive!,
        });
      await page.locator("#packages").selectOption({ label: name });
      await page.locator("#controller1").selectOption("human");
      await page
        .getByRole("button", { name: "Play locally", exact: true })
        .click();
      for (const [who, actor, to] of script) await act(page, actor, to);
      await expect(page.locator("#status")).toContainText("Winner p1");
    },
  );
