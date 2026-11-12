import { loadEnvFile } from 'node:process';

try {
  loadEnvFile('.env');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw error;
  }
}

export const APP_BASE_URL = (process.env.APP_BASE_URL ?? 'http://localhost:8081').replace(/\/+$/, '');
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'LocalDemoAdmin123!';
export const WAREHOUSE_USERNAME = process.env.WAREHOUSE_USERNAME ?? 'warehouse';
export const WAREHOUSE_PASSWORD = process.env.WAREHOUSE_PASSWORD ?? 'warehouse';

// Background work in the stack, and how long the tests wait for it:
// - payment-service settles the delayed test cards after PAYMENT_SETTLEMENT_DELAY (10 s)
// - its result reaches the backend through a retrying outbox (a few seconds)
// - warehouse and payment poll the backend event feed every 5 s, events are offered 3 s after commit
// - webhook deliveries are sent by a scheduled job
export const ASYNC_TIMEOUT = Number(process.env.ASYNC_TIMEOUT_MS ?? 45_000);
export const POLL_INTERVALS = [250, 500, 1_000, 2_000];
