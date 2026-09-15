import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
    "src/data/fec/**",
  ]),
  {
    files: ["postcss.config.js", "tailwind.config.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
]);
