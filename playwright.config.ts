import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: "http://localhost:3001",
    channel: "msedge",
    headless: true,
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
  },
});
