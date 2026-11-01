import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import testingLibrary from "eslint-plugin-testing-library";
import vitest from "@vitest/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "coverage"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ["src/test/**/*.{ts,tsx}", "src/**/__tests__/**/*.{ts,tsx}"],
    extends: [testingLibrary.configs["flat/react"], vitest.configs.recommended],
    rules: {
      // The test helpers are .tsx files exporting non-components on purpose;
      // Fast Refresh never applies to them.
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["src/test/setup.ts"],
    rules: {
      "testing-library/no-manual-cleanup": "off",
    },
  },
]);
