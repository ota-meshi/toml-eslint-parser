import myPlugin from "@ota-meshi/eslint-plugin";
import globals from "globals";

export default [
  {
    ignores: [
      ".nyc_output",
      "coverage",
      "lib",
      "node_modules",
      "tests/fixtures/**/*.json",
      "tests/fixtures/**/*.yaml",
      "tests/fixtures/**/*.yml",
      "!.github",
      "toml-test-decode-last-result.json",
    ],
  },
  ...myPlugin.config({
    node: true,
    ts: true,
    prettier: true,
    packageJson: true,
    json: true,
    yaml: true,
    vue3: { withTs: false },
  }),
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "new-cap": "off",
      "no-warning-comments": "warn",
      "no-lonely-if": "off",
      "no-param-reassign": "off",
      "no-shadow": "off",
      "n/hashbang": "off",
    },
  },
  {
    files: ["**/*.{js,ts,mjc,mts,cjs,cts}"],
    rules: {
      "n/prefer-node-protocol": "error",
      "n/file-extension-in-import": ["error", "always"],
    },
    settings: {
      n: {
        typescriptExtensionMap: [],
      },
    },
  },
  {
    files: ["explorer/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        module: "readonly",
        require: "readonly",
      },
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      sourceType: "module",
      parserOptions: {
        project: true,
      },
    },

    rules: {
      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "memberLike",
          format: ["camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "property",
          format: null,
        },
        {
          selector: "method",
          format: null,
        },
        {
          selector: "import",
          format: null,
        },
      ],
      "no-implicit-globals": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-use-before-define": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["scripts/**/*.ts", "tests/**/*.ts"],
    rules: {
      "jsdoc/require-jsdoc": "off",
      "no-console": "off",
    },
  },
  {
    files: ["explorer/**/*.{ts,mts,js,mjs,vue}"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "n/no-unsupported-features/es-syntax": "off",
      "n/no-missing-import": "off",
      "jsdoc/require-jsdoc": "off",
    },
  },
  {
    files: ["benchmark/**/*.ts"],
    rules: {
      "n/no-missing-import": "off",
      "jsdoc/require-jsdoc": "off",
      "no-console": "off",
    },
  },
];
