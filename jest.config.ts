import type { Config as JestConfig } from "jest";

/**
 * Test coverage options.
 */
const coverageOptions: Pick<
  JestConfig,
  | "collectCoverage"
  | "coverageDirectory"
  | "coveragePathIgnorePatterns"
  | "coverageProvider"
  | "coverageReporters"
  | "coverageThreshold"
  | "collectCoverageFrom"
  | "forceCoverageMatch"
> = {
  coverageProvider: "v8",
  collectCoverageFrom: ["<rootDir>/src/**/*.tsx"],
};

/**
 * Jest configuration.
 * @see https://jestjs.io/docs/configuration
 */
const jestConfig: JestConfig = {
  // throw error on deprecated API usage
  errorOnDeprecated: true,
  modulePaths: ["<rootDir>/src"],
  transform: {
    // run tests with`@swc/jest`: https://swc.rs/docs/usage/jest
    "^.+\\.(mjs|ts|tsx)$": [
      "@swc/jest",
      {
        jsc: {
          transform: {
            react: {
              // enable support for React 17 JSX transform: https://legacy.reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html
              runtime: "automatic",
            },
          },
        },
      },
    ],
  },
  ...coverageOptions,
};

export default jestConfig;
