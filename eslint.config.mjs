import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'evals/reports/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Zapobiega przypadkowemu wypisaniu tresci bundla; uzywaj Logger z NestJS
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
