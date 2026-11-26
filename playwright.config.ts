import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against `npm run dev` (http://localhost:3000) and the LOCAL Supabase
// stack (`npx supabase start`). Helpers read .env.local; see docs/dev-notes.md.
//
// I7 production mode (opt-in): `npm run test:e2e:prod` (or E2E_PROD=1) builds and serves the app with
// `next build && next start` on port 3100, so prerendering, caching and the production error handling are
// tested too. npm sets npm_lifecycle_event to the script name, which avoids a cross-env dependency on Windows.
const PROD = process.env.E2E_PROD === "1" || process.env.npm_lifecycle_event === "test:e2e:prod";
const BASE_URL = PROD ? "http://localhost:3100" : "http://localhost:3000";

// Task 19: the cron route fails closed without CRON_SECRET. Outside CI a fixed, obviously-fake value (never a
// real secret); in CI the job sets CRON_SECRET itself. Computed once here, before any spec runs, and handed to
// the specs as E2E_CRON_SECRET (workers inherit this process's env). The specs must not read CRON_SECRET:
// tests/e2e/helpers/supabase-admin.ts loads .env.local into the worker, which may hold the real deploy secret
// while the dev server below still has this value.
process.env.E2E_CRON_SECRET ??= process.env.CI ? (process.env.CRON_SECRET ?? "") : process.env.CRON_SECRET || "e2e-cron-secret";
const CRON_SECRET = process.env.E2E_CRON_SECRET;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  // Ruling R17: the skeleton spec needs Link prefetching, which exists in production only (it is in test:e2e:prod).
  testIgnore: PROD ? [] : ["**/skeletons.spec.ts"],
  // Tests share one database; run them one at a time.
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    // Task 20 (R139): the demo scripts (scripts/demo). Not part of test:e2e: it seeds, resets and PURGES the
    // local database (every user except real admins). Run only with `npm run test:seed` (the spec skips
    // itself otherwise). Local Supabase only (CONFIRM_PROJECT_REF=local).
    { name: "seed", testDir: "./tests/seed", timeout: 300_000, use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: PROD ? "npm run build && npm run start -- --port 3100" : "npm run dev",
    url: BASE_URL,
    // prod mode always builds the current code (never reuses a stale server on 3100)
    reuseExistingServer: !process.env.CI && !PROD,
    // A dev server started by hand needs the same value: CRON_SECRET=e2e-cron-secret npm run dev.
    // Google sign-in buttons on (tests/e2e/google-signin.spec.ts intercepts the Supabase authorize request).
    env: process.env.CI ? { NEXT_PUBLIC_GOOGLE_AUTH: "on" } : { CRON_SECRET, NEXT_PUBLIC_GOOGLE_AUTH: "on" },
    timeout: PROD ? 600_000 : 180_000,
  },
});
