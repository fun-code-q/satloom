// Flat ESLint config.
//
// Next.js 16 removed the `next lint` command, and the eslint-config-next it
// brings in ships ESLint 9 + native flat configs. So the old .eslintrc.json
// (extends "next/core-web-vitals" + "plugin:@typescript-eslint/recommended")
// no longer applies and is replaced by this file.
//
// The imports below are eslint-config-next's own flat exports. They are used
// directly rather than through FlatCompat: the v16 configs are already flat,
// and running them back through the eslintrc compat layer fails schema
// validation with a circular-reference error.
//
// The three "warn" rules are carried over deliberately — they were set that
// way so the lint gate stays green while the unused-vars / no-explicit-any
// backlog is worked down. Changing them to errors would fail CI today.
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

const projectRoot = dirname(fileURLToPath(import.meta.url))

export default [
  {
    // Mirrors tsconfig.json's excludes plus build output and local scratch.
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "functions/**",
      ".local/**",
      "next-env.d.ts",
      // Documented dead code, already excluded from tsconfig.json — see
      // DEPRECATED.md. Kept out of lint for the same reason.
      "utils/core/worker-manager.ts",
      "sat-loom-web-app v5 latest 1/**",
      "beatdrop---south-indian-party/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    settings: { next: { rootDir: projectRoot } },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          vars: "all",
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",

      // --- New in eslint-plugin-react-hooks v6 (arrives with Next 16) ---
      //
      // These are the React Compiler-adjacent rules. They default to "error"
      // and flag ~130 pre-existing places in this codebase — none of them
      // regressions, they simply were not checked before. Failing the build on
      // day one of the upgrade would just mean the gate gets disabled, so they
      // are warnings on the same terms as the rules above: visible backlog,
      // green gate.
      //
      // They are worth working down. set-state-in-effect in particular flags
      // render-loop-prone patterns, and this app already had measurable
      // re-render churn.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
  {
    // Config files and standalone scripts are CommonJS by nature.
    files: ["*.config.{js,cjs,mjs,ts}", "tailwind.config.ts", "postcss.config.*", "test_firebase.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@next/next/no-assign-module-variable": "off",
    },
  },
]
