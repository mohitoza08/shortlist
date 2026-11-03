import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  // Reuses a running `next start` (AI_MOCK=1, seeded database) or starts one.
  webServer: { command: "npm run start", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
