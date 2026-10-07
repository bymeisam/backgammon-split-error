import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Galaxy's compiled web client: gitignored local reference, not our code.
    "galaxy-source/**",
    // The visual-regression suite's dedicated dev server output (see
    // playwright.config.ts, next.config.ts's distDir override) — same kind
    // of auto-generated, unlinted content as .next/** above, just under a
    // different name since both can't share one distDir.
    ".next-test/**",
  ]),
]);

export default eslintConfig;
