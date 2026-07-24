import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Boundary rules
  {
    files: ["src/core/**/*.ts", "src/core/**/*.tsx"],
    rules: {
      // src/core/** may not import from src/modules/**
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/modules/*", "@/modules/**"],
          message: "The kernel (src/core/) must not import from modules. Modules depend on core, never the reverse."
        }]
      }]
    }
  },
  {
    files: ["src/modules/**/*.ts", "src/modules/**/*.tsx", "src/app/**/*.ts", "src/app/**/*.tsx", "src/actions/**/*.ts"],
    rules: {
      // src/core/db/admin may not be imported outside src/core/**
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/core/db/admin"],
          message: "dbAdmin (RLS bypass) is restricted to src/core/**. Use dbAs() instead."
        }]
      }]
    }
  }
]);

export default eslintConfig;
