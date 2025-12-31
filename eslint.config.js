// @ts-check
import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default defineConfig(
  // Global ignores
  globalIgnores(['dist', 'node_modules', 'coverage']),

  // Base ESLint rules
  eslint.configs.recommended,

  // TypeScript strict + stylistic (sans type-checking pour la perf)
  tseslint.configs.strict,
  tseslint.configs.stylistic,

  // Configuration spécifique au projet
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      // Ajustements pour la codebase existante
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
      'no-case-declarations': 'off',
      'prefer-const': 'warn',
      'no-empty': 'warn',
    },
  },

  // Ignores locaux pour tests/scripts
  {
    ignores: ['tests/**', 'scripts/**'],
  }
);
