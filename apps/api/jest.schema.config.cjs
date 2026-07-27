/* global module, process */
process.env.NODE_ENV = 'test';

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/schema/**/*.spec.ts'],
  testTimeout: 30_000,
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
};
