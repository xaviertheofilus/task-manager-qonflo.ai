import { defineConfig } from "@playwright/test";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  use: { baseURL: "http://127.0.0.1:5173" },
  webServer: [
    {
      command: `${npm} run dev:server`,
      url: "http://127.0.0.1:3001/api/tasks",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `${npm} run dev:client -- --host 127.0.0.1`,
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
