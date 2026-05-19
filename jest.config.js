/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  clearMocks: true,
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        diagnostics: { ignoreCodes: [151002] },
        tsconfig: { types: ["jest", "node"] },
      },
    ],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(@actions)/)",
  ],
  moduleNameMapper: {
    "^@actions/(.*)$": "<rootDir>/node_modules/@actions/$1",
  },
};
