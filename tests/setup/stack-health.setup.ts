import { test as setup } from '@playwright/test';
import { expect } from '@support/expect';
import { APP_BASE_URL } from '@config';

// Runs once before every project. A stopped or half-started stack fails here with one clear message
// instead of failing every test with connection errors.
const services = [
  { name: 'gateway and frontend', path: '/login' },
  { name: 'backend', path: '/v3/api-docs' },
  { name: 'payment-service', path: '/payment/v3/api-docs' },
  { name: 'warehouse-service', path: '/warehouse/v3/api-docs' },
  { name: 'notification-service', path: '/notification/v3/api-docs' },
];

setup.describe('stack health', () => {
  for (const service of services) {
    setup(`${service.name} answers through the gateway`, async ({ request }) => {
      const response = await request.get(service.path, { failOnStatusCode: false }).catch((error: Error) => {
        throw new Error(`${APP_BASE_URL}${service.path} is unreachable. Start awesome-localstack first (see README). ${error.message}`);
      });
      await expect(response, `${service.name} at ${APP_BASE_URL}${service.path}`).toHaveStatus(200);
    });
  }
});
