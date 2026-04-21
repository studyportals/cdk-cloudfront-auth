// @ts-check
const tseslint = require("typescript-eslint")
const prettierConfig = require("eslint-config-prettier")
const prettierPlugin = require("eslint-plugin-prettier")

module.exports = tseslint.config(
  {
    ignores: ["dist/", "lib/", "example/", "cdk.out/", "webpack.config.js", "eslint.config.js", "jest.config.js"],
  },
  {
    files: ["src/**/*.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    plugins: { prettier: prettierPlugin },
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
      },
    },
    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
  prettierConfig,
)
