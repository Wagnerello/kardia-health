// Fast lint tier. Everything here runs without type information, which is
// what keeps it quick enough for a pre-commit hook. The rules that need the
// type checker live in eslint.typed.config.mjs and run on their own script.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

import quality from "./eslint-rules/index.cjs";

export default defineConfig([
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
      globals: {
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLSelectElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLDialogElement: "readonly",
        Blob: "readonly",
        FileReader: "readonly",
        Image: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        FormData: "readonly",
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.strict,

  {
    plugins: { "import-x": importX, "import-x-debt": importX },
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver()],
    },
    rules: {
      "import-x/no-unresolved": "error",
      "import-x/no-duplicates": "error",
      // Sem zonas de erro novas no momento:
      "import-x/no-restricted-paths": "off",
      // Dívida existente de fronteira arquitetural anotada com baseline
      "import-x-debt/no-restricted-paths": [
        "warn", // baseline: 1 violação em src/main.ts
        {
          zones: [
            { target: "./src/main.ts", from: "./src/firebase.ts" },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx,mjs,cjs}"],
    plugins: { quality },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-var": "error",
      "prefer-const": "warn", // baseline: 2 violações
      "no-useless-catch": "warn", // baseline: 1 violação
      "@typescript-eslint/no-explicit-any": "warn", // baseline: 194 violações
      "@typescript-eslint/no-non-null-assertion": "warn", // baseline: 48 violações
      "@typescript-eslint/no-unused-vars": [
        "warn", // baseline: 12 violações
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Orçamento de tamanho e complexidade em warn
      complexity: ["warn", 12],
      "max-depth": ["warn", 4],
      "max-statements": ["warn", 20],
      "max-params": ["warn", 4],
      "max-lines-per-function": [
        "warn",
        { max: 150, skipBlankLines: true, skipComments: true },
      ],
      "max-nested-callbacks": ["warn", 3],

      // Quality gates principais:
      // quality/max-lines mantido em error para 100% dos arquivos do projeto
      "quality/max-lines": [
        "error",
        {
          max: 350,
          ignore: [],
        },
      ],
      // quality/no-direct-console com baseline registrada
      "quality/no-direct-console": [
        "warn", // baseline: 76 violações
        { logger: "o adaptador de log do projeto" },
      ],
      // quality/no-direct-data-access: 0 violações no padrão de importação direta de db na camada de UI
      "quality/no-direct-data-access": [
        "error",
        {
          modules: ["./firebase", "../firebase", "./firebase.ts", "../firebase.ts"],
          bindings: ["db"],
          layers: ["/src/main.ts"],
        },
      ],
    },
  },
  {
    files: [
      "**/*.test.{ts,tsx}",
      "**/{__tests__,__mocks__,fixtures,mocks}/**/*.{ts,tsx}",
    ],
    plugins: { quality },
    rules: {
      "quality/max-lines": ["warn", { includeTests: true, max: 350 }],
    },
  },
  {
    files: ["src/services/logger.ts", "src/services/telemetry.ts"],
    rules: {
      "quality/no-direct-console": "off",
    },
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "max-statements": "off",
      "max-lines-per-function": "off",
      "max-nested-callbacks": "off",
      "import-x/no-restricted-paths": "off",
      "import-x-debt/no-restricted-paths": "off",
    },
  },
  {
    files: ["eslint-rules/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "readonly", require: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    ".claude/**",
    ".agents/**",
    ".github/**",
    ".husky/**",
    "node_modules/**",
    "dist/**",
    "build/**",
    "coverage/**",
    "functions/**",
    "graphify-out/**",
    "public/**",
    "**/*.tsbuildinfo",
    "package-lock.json",
    "*.cjs",
    "scripts/**",
    "*.js",
    "*.html",
  ]),
]);
