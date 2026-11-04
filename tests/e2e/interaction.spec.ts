import { test, expect } from "@playwright/test";
import { load, pack } from "../../packages/modkit/index.ts";
import { tile } from "../../packages/engine/index.ts";
for (const width of [1280, 390])
  test(
    "production choice, pending save restore and completion at " + width,
    async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      const p = load("mods/swarm-basic-prototype/package.json");
      p.id = "browser-fixture";
      p.name = "Browser decision fixture";
      p.rules.goal = 1;
      const q = p.setup.find((e) => e.id === "Bq")!,
        w = p.setup.find((e) => e.id === "Aw")!,
        near = tile(p, q.tile).edges.find(
          (t) => t && !p.setup.some((e) => e.tile === t),
        )!;
      w.tile = near;
      p.tiles.forEach(
        (t) => (t.terrain = t.id === near ? "flower" : "ordinary"),
      );
      await page.locator("#import").setInputFiles({
        name: "fixture.hexmod",
        mimeType: "application/octet-stream",
        buffer: Buffer.from(pack(p)),
      });
      await page.locator("#packages").selectOption({ label: p.name });
      await page.locator("#controller1").selectOption("human");
      await page
        .getByRole("button", { name: "Play locally", exact: true })
        .click();
      await page.getByLabel("Select bee").selectOption("Aw");
      await page.getByLabel("Movement route").selectOption({ label: q.tile });
      await page.getByRole("button", { name: "Move selected route" }).click();
      await expect(page.locator("#status")).toContainText(
        "p2 chooses production",
      );
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const file = await (await download).path();
      await page.getByRole("button", { name: "Mods", exact: true }).click();
      await page.locator("#packages").selectOption({ label: p.name });
      await page.locator("#load").setInputFiles(file!);
      await expect(page.locator("#status")).toContainText(
        "p2 chooses production",
      );
      const choice = await page
        .getByLabel("Decision options")
        .locator("option")
        .evaluateAll(
          (os) =>
            (os as HTMLOptionElement[]).find((o) =>
              o.value.startsWith("honey:"),
            )!.value,
        );
      await page.getByLabel("Decision options").selectOption(choice);
      await page.getByRole("button", { name: "Confirm choice" }).click();
      await expect(page.locator("#status")).toContainText(
        "p1 chooses departure",
      );
      await expect(page.locator("#status")).not.toContainText("Winner");
      await page.screenshot({ path: info.outputPath("pending-departure.png") });
      await page.getByRole("button", { name: "Confirm choice" }).click();
      await expect(page.locator("#status")).toContainText("Winner p2");
    },
  );
test("canvas taps stage Bumblebee preview without AP then commit one AP; Undo restores", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#controller1").selectOption("human");
  await page.getByRole("button", { name: "Play locally", exact: true }).click();
  await page.getByLabel("Select bee").selectOption("Ab");
  const route = await page
    .getByLabel("Movement route")
    .locator("option")
    .first()
    .textContent();
  const to = route!.split(" → ")[0];
  const cells = JSON.parse(
    (await page.locator("canvas").getAttribute("data-cells")) ?? "[]",
  );
  const t = cells.find((t) => t.id === to);
  await page.locator("canvas").click({ position: { x: t.x, y: t.y } });
  await expect(page.locator("#status")).toContainText("6 AP");
  await expect(
    page.getByRole("button", { name: "Finish move", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Finish move", exact: true }).click();
  await expect(page.locator("#status")).toContainText("5 AP");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#status")).toContainText("6 AP");
});
test("browser local mode works with all API traffic blocked", async ({
  page,
}) => {
  await page.route("**/api/**", (r) => r.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Play locally", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "End activation" }).click();
  await expect(page.locator("#status")).toContainText("Hive B");
});
test("six hive flat rendering frame samples and ten-cycle resource evidence", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.locator("#count").fill("6");
  await page.locator("#count").dispatchEvent("change");
  for (let i = 0; i < 6; i++)
    await page.locator("#controller" + i).selectOption("human");
  await page.getByRole("button", { name: "Play locally", exact: true }).click();
  const framePromise = page.evaluate(async () => {
    const frames: number[] = [];
    let last = performance.now();
    for (let i = 0; i < 180; i++) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const now = performance.now();
      frames.push(now - last);
      last = now;
    }
    frames.sort((a, b) => a - b);
    return {
      median: frames[90],
      p95: frames[171],
      over50: frames.filter((x) => x > 50).length,
      heap: (performance as any).memory?.usedJSHeapSize,
    };
  });
  const box=await page.locator("canvas").boundingBox();await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2+50,box!.y+box!.height/2+35,{steps:30});await page.mouse.up();const frames=await framePromise;await page.getByRole("button",{name:"Recenter",exact:true}).click();await info.attach("frame-times", {
    body: JSON.stringify(frames),
    contentType: "application/json",
  });
  await page.screenshot({ path: info.outputPath("six-hive-flat.png") });
  expect(await page.locator("canvas").count()).toBe(1);
});

test('sound enables on gesture, mute and Undo avoid historical cues',async({page})=>{await page.addInitScript(()=>{(window as any).cueStarts=0;const original=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){const node=original.call(this);const start=node.start.bind(node);node.start=(...args:any[])=>{(window as any).cueStarts++;return start(...args)};return node}});await page.goto('/');await page.getByRole('button',{name:'Sound',exact:true}).click();await page.locator('#controller1').selectOption('human');await page.getByRole('button',{name:'Play locally',exact:true}).click();await page.getByLabel('Select bee').selectOption('Aw');await page.getByRole('button',{name:'Move selected route'}).click();const sounds=await page.evaluate(()=>(window as any).cueStarts);expect(sounds).toBeGreaterThan(0);await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await page.evaluate(()=>(window as any).cueStarts)).toBe(sounds);await page.getByRole('button',{name:'Mute sound',exact:true}).click();await page.getByLabel('Select bee').selectOption('Aw');await page.getByRole('button',{name:'Move selected route'}).click();expect(await page.evaluate(()=>(window as any).cueStarts)).toBe(sounds)});