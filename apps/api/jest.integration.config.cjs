/* global module, process */
process.env.NODE_ENV = 'test';

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@flash-sale/domain$': '<rootDir>/../../packages/domain/src/index.ts',
  },
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/test/flash-sale/**/*.spec.ts',
    '<rootDir>/test/purchase/**/*.spec.ts',
    '<rootDir>/test/graphql/**/*.spec.ts',
  ],
  testTimeout: 30_000,
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
};
