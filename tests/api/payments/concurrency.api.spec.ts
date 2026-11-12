import { test, expect } from '@fixtures';
import { Shopper } from '@support/shopper';

// Regression for bugs/BUG-PAYMENTS-02: with a pool of three connections, a request that needs a second
// connection while holding the first deadlocks the pool as soon as three such requests overlap.
const CONCURRENT_PAYMENTS = 8;

test.describe('POST /api/v1/payments under concurrency', { tag: ['@payments'] }, () => {
  test('pays many first-time orders at the same moment without exhausting the connection pool - 201', async ({ api }) => {
    test.fixme(true, 'bugs/BUG-PAYMENTS-02-connection-pool-starvation-under-concurrent-payments.md');
    // given
    const shoppers = await Promise.all(Array.from({ length: CONCURRENT_PAYMENTS }, () => Shopper.create(api)));
    const orders = await Promise.all(shoppers.map(async shopper => (await shopper.placeOrder(25)).order));

    // when
    const startedAt = Date.now();
    const responses = await Promise.all(shoppers.map((shopper, index) => shopper.payments.pay(orders[index].id)));
    const elapsed = Date.now() - startedAt;

    // then
    for (const response of responses) await expect(response).toHaveStatus(201);
    expect(elapsed, 'all payments answered well before the 30 s pool timeout').toBeLessThan(10_000);
    await Promise.all(shoppers.map((shopper, index) => shopper.waitForOrderStatus(orders[index].id, 'PAID')));
  });
});
