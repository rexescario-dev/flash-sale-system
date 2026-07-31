import shared from './packages/eslint-config/index.js';

/** k6 scripts run in the k6 runtime, not Node — declare k6 globals for ESLint. */
const k6Globals = {
  __ENV: 'readonly',
  __ITER: 'readonly',
  __VU: 'readonly',
  open: 'readonly',
};

export default [
  ...shared,
  {
    ignores: ['tests/stress/.state/**', 'tests/stress/results/**'],
  },
  {
    files: ['tests/stress/k6/**/*.{js,ts}'],
    languageOptions: {
      globals: k6Globals,
    },
  },
];
