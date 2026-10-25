import { defineConfig } from "@playwright/test";

// Redesign screenshot harness: `npx playwright test -c tests/redesign/screens.config.ts --grep @shell`
// Images land in test-results/screens/<group>/ (not committed). Needs LOCAL Supabase + `npm run dev`.
export default defineConfig({
  testDir: "./",
  testMatch: "screens.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 600_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  outputDir: "../../test-results/screens-run",
  use: {
    baseURL: "http://localhost:3000",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: process.env.CI ? {} : { CRON_SECRET: process.env.CRON_SECRET || "e2e-cron-secret" },
    timeout: 180_000,
  },
});
