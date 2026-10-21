import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against `npm run dev` (http://localhost:3000) and the LOCAL Supabase
// stack (`npx supabase start`). Helpers read .env.local; see docs/dev-notes.md.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  // Tests share one database; run them one at a time.
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // Task 19: the cron route fails closed without CRON_SECRET. A fixed, obviously-fake value for local
    // runs only (never CI, never a real secret). A dev server started by hand needs the same value:
    // CRON_SECRET=e2e-cron-secret npm run dev. tests/e2e/cleanup-orphans.spec.ts reads the same default.
    env: process.env.CI ? {} : { CRON_SECRET: process.env.CRON_SECRET || "e2e-cron-secret" },
    timeout: 180_000,
  },
});
