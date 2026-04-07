/** @type {import('jest').Config} */
const config = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^~/(.*)$": "<rootDir>/src/$1",
  },
};

module.exports = config;
