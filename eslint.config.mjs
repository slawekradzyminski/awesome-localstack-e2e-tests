import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
  { ignores: ['localstack/', 'node_modules/', 'playwright-report/', 'test-results/', 'blob-report/', 'eslint.config.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // A missing await on a Playwright call is the most common flaky-test bug.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
      // response.json() is untyped by design; DTO types are applied at the call site.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
  {
    files: ['tests/**/*.ts', 'pages/**/*.ts', 'support/**/*.ts', 'fixtures/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-page-pause': 'error',
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/no-useless-await': 'error',
      'playwright/prefer-to-have-length': 'error',
      'playwright/require-top-level-describe': 'error',
      // Tests read top to bottom: no branching, no steps inside steps, no expect behind a condition.
      'playwright/no-conditional-in-test': 'error',
      'playwright/no-conditional-expect': 'error',
      'playwright/no-nested-step': 'error',
      'playwright/no-duplicate-hooks': 'error',
      'playwright/prefer-hooks-on-top': 'error',
      'playwright/prefer-comparison-matcher': 'error',
      'playwright/prefer-equality-matcher': 'error',
      'playwright/prefer-native-locators': 'error',
      'playwright/require-to-throw-message': 'error',
      'playwright/max-nested-describe': ['error', { max: 2 }],
      // Assertions live in helpers (Shopper.waitFor*, WebhookInbox.waitFor) as well as in tests.
      'playwright/expect-expect': ['error', { assertFunctionNames: ['expect*', 'waitFor*', 'payAndWaitForPaid', 'advanceUntil'], assertFunctionPatterns: ['^expect', '^waitFor'] }],
    },
  },
);
