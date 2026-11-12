import { defineConfig, devices } from '@playwright/test';
import { APP_BASE_URL } from './test-config';

/**
 * Three projects against one running awesome-localstack (http://localhost:8081 by default):
 * - api:      HTTP-level tests per feature, one spec per endpoint group
 * - ui:       browser tests per feature, data prepared through the API
 * - journeys: cross-service stories that follow an order through backend, payment-service,
 *             the event feed, warehouse-service and webhooks
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 4 } : {}),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  use: {
    baseURL: APP_BASE_URL,
    // The production edge blocks unknown clients; an explicit agent keeps API calls looking like a browser tool.
    ...(process.env.TEST_USER_AGENT ? { userAgent: process.env.TEST_USER_AGENT } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'stack-health', testDir: './tests/setup', testMatch: /.*\.setup\.ts/ },
    { name: 'api', testDir: './tests/api', dependencies: ['stack-health'] },
    { name: 'ui', testDir: './tests/ui', dependencies: ['stack-health'], use: { ...devices['Desktop Chrome'] } },
    {
      name: 'journeys',
      testDir: './tests/journeys',
      dependencies: ['stack-health'],
      timeout: 180_000,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
