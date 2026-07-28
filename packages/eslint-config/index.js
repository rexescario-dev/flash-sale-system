import js from '@eslint/js';
import perfectionist from 'eslint-plugin-perfectionist';
import tseslint from 'typescript-eslint';

/** ID-like keys/members first (id, productId, userId, …), then everything else A→Z. */
const idFirstCustomGroups = [
  {
    elementNamePattern: ['^id$', 'Id$'],
    groupName: 'ids',
  },
];

const idFirstGroups = ['ids', 'unknown'];

/**
 * Shared ESLint flat config for Flash Sale System apps.
 * Formatting is owned by Prettier — this package focuses on code quality.
 */
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/.turbo/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      perfectionist,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // NestJS @Module({ imports|providers|exports }) arrays:
      // static identifiers first (A→Z), then dynamic *.forRoot(...) calls (A→Z).
      // Import order is not behavioral for our feature slices; ConfigModule.forRoot
      // still loads .env when it initializes (prefer env already present at process start).
      'perfectionist/sort-arrays': [
        'error',
        {
          customGroups: [
            {
              // Bare identifiers only (e.g. FlashSaleModule), not CallExpressions.
              elementNamePattern: '^[A-Za-z_][A-Za-z0-9_]*$',
              groupName: 'static-modules',
            },
            {
              elementNamePattern: '\\.forRoot',
              groupName: 'dynamic-modules',
            },
          ],
          groups: ['static-modules', 'dynamic-modules', 'unknown'],
          order: 'asc',
          type: 'alphabetical',
          useConfigurationIf: {
            matchesAstSelector:
              'Decorator[expression.callee.name="Module"] > CallExpression > ObjectExpression > Property[key.name=/^(exports|imports|providers)$/] > ArrayExpression',
          },
        },
      ],
      'perfectionist/sort-classes': [
        'error',
        {
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-enums': [
        'error',
        {
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-exports': [
        'error',
        {
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-imports': [
        'error',
        {
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-interfaces': [
        'error',
        {
          customGroups: idFirstCustomGroups,
          groups: idFirstGroups,
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-named-exports': [
        'error',
        {
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-named-imports': [
        'error',
        {
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-object-types': [
        'error',
        {
          customGroups: idFirstCustomGroups,
          groups: idFirstGroups,
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-objects': [
        'error',
        {
          customGroups: idFirstCustomGroups,
          groups: idFirstGroups,
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-union-types': [
        'error',
        {
          order: 'asc',
          type: 'alphabetical',
        },
      ],
    },
  },
);
