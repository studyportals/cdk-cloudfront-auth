// Override values in CDK stacks during tests.
process.env.IS_SNAPSHOT = "true"

module.exports = {
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
    "^.+\\.js$": ["ts-jest", { tsconfig: { allowJs: true } }],
  },
  transformIgnorePatterns: ["node_modules/(?!(jose)/)"],
  moduleNameMapper: {
    "\\.html$": "<rootDir>/file-mock.js",
  },
}
