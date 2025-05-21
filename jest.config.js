/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
  testEnvironment: "node",
  transform: {
    "^.+.tsx?$": ["ts-jest", {}],
  },
  testMatch: ["**/*.test.[jt]s?(x)"],
  testPathIgnorePatterns: ["<rootDir>/tests/integration/"],
  setupFiles: ["<rootDir>/jest.setup.js"],
};
