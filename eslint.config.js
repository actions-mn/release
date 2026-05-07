import github from 'eslint-plugin-github';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';
import eslintComments from 'eslint-plugin-eslint-comments';
import importPlugin from 'eslint-plugin-import';
import i18nTextPlugin from 'eslint-plugin-i18n-text';
import noOnlyTestsPlugin from 'eslint-plugin-no-only-tests';
import { fixupPluginRules } from '@eslint/compat';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'lib/**',
      'dist/**',
      '**/*.test.ts',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 12,
      sourceType: 'module',
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      github: fixupPluginRules(github),
      prettier: prettierPlugin,
      'eslint-comments': eslintComments,
      import: importPlugin,
      'i18n-text': fixupPluginRules(i18nTextPlugin),
      'no-only-tests': noOnlyTestsPlugin,
    },
    rules: {
      'i18n-text/no-en': 'off',
      'eslint-comments/no-use': 'off',
      'import/no-namespace': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'no-public',
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      camelcase: 'off',
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.ts'],
        },
      },
    },
  },
];
