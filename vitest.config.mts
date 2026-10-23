import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// .mts: loaded as ESM (no CJS configLoader warning); __dirname does not exist here.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Unit tests live next to the code (src/, and the pure helpers of scripts/demo); Playwright specs in
  // tests/e2e and tests/seed are not Vitest tests.
  test: { environment: "node", include: ["src/**/*.test.ts", "scripts/**/*.test.ts"], exclude: ["tests/e2e/**", "node_modules/**"] },
});
