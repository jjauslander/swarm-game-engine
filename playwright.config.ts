import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: "msedge",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run host:start",
      url: "http://127.0.0.1:5174/api/packages",
      reuseExistingServer: true,
    },
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
    },
  ],
});
