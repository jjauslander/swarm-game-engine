import { test, expect } from "@playwright/test";
test("local flat board, two-segment movement, save and menus on desktop", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Play locally", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#status")).toContainText("Swarm Basic Prototype");
  await page.getByRole("button", { name: "End activation" }).click();
  await expect(page.locator("#status")).toContainText("Hive B");
  await page.getByRole("button", { name: "Mods", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play locally", exact: true }),
  ).toBeVisible();
});
test("phone viewport fits controls and switches packages ten times", async ({
  page,
}, info) => {
  const cdp = await page.context().newCDPSession(page),
    samples: any[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (let i = 0; i < 10; i++) {
    await page
      .locator("#packages")
      .selectOption({
        label: i % 2 ? "Outpost Capture" : "Swarm Basic Prototype",
      });
    await page
      .getByRole("button", { name: "Play locally", exact: true })
      .click();
    await expect(page.locator("canvas")).toBeVisible();
    await page.getByRole("button", { name: "Recenter", exact: true }).click();
    await page.getByRole("button", { name: "Mods", exact: true }).click();
    await expect(page.locator("canvas")).toHaveCount(0);
    await cdp.send("HeapProfiler.collectGarbage");
    samples.push({
      ...(await cdp.send("Memory.getDOMCounters")),
      ...(await cdp.send("Runtime.getHeapUsage")),
    });
  }
  await info.attach("lifetime-samples", {
    body: JSON.stringify(samples),
    contentType: "application/json",
  });
  expect(samples[9].jsEventListeners).toBeLessThanOrEqual(
    samples[3].jsEventListeners + 10,
  );
  expect(samples[9].usedSize - samples[3].usedSize).toBeLessThan(3000000);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("two network seats enforce revision/authority and reconnect", async ({
  browser,
  request,
}) => {
  const packages = await (
    await request.get("http://127.0.0.1:5174/api/packages")
  ).json();
  const p = packages.find((x) => x.package.id === "swarm-basic-prototype");
  const match = await (
    await request.post("http://127.0.0.1:5174/api/create", {
      data: { digest: p.digest, owners: { A: "p1", E: "p2" }, seed: 3 },
    })
  ).json();
  const a = await browser.newContext(),
    b = await browser.newContext();
  const pa = await a.newPage(),
    pb = await b.newPage();
  for (const [page, seat] of [
    [pa, match.seats[0]],
    [pb, match.seats[1]],
  ] as any) {
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
  await pa.getByRole("button", { name: "End activation" }).click();
  await expect(pb.locator("#status")).toContainText("Hive E");
  await pb.reload();
  await pb.getByRole("button", { name: "Reconnect last seat" }).click();
  await expect(pb.locator("#status")).toContainText("Hive E");
  await a.close();
  await b.close();
});
