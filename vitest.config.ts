import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors tsconfig.json's "@/*" -> "./*" path alias so test files can
// import app code the same way the app itself does.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    // e2e/ is Playwright's suite (npm run test:visual, playwright.config.ts)
    // — a separate runner entirely, per the ask. Vitest's default include
    // glob would otherwise also pick up e2e/*.spec.ts and fail trying to
    // run Playwright's test() against a browser that isn't there.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
