/* global module */
/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    // Source imports use NodeNext-style `.js` suffixes; strip for ts-jest resolution.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'Node',
          types: ['jest'],
        },
      },
    ],
  },
};
