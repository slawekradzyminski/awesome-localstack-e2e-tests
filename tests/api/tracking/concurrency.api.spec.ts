import { test, expect } from '@fixtures';
import { Shopper } from '@support/shopper';

// Regression for bugs/BUG-WAREHOUSE-01: concurrent fulfilment must not starve warehouse-service's connection pool.
const CONCURRENT_SHIPMENTS = 8;

test.describe('warehouse fulfilment under concurrency', { tag: ['@tracking'] }, () => {
  test('creates, picks, packs and ships many orders at the same moment - 200', async ({ api, warehouse, parcels }) => {
    test.fixme(true, 'bugs/BUG-WAREHOUSE-01-connection-pool-starvation-under-concurrent-fulfilment.md');
    // given
    const shoppers = await Promise.all(Array.from({ length: CONCURRENT_SHIPMENTS }, () => Shopper.create(api)));
    const orders = await Promise.all(shoppers.map(async shopper => {
      const { order } = await shopper.placeOrder(30);
      await shopper.payAndWaitForPaid(order.id);
      return order;
    }));

    // when
    const startedAt = Date.now();
    const shipped = await Promise.all(orders.map(order => warehouse.shipSimulated(order.id)));
    const elapsed = Date.now() - startedAt;

    // then
    expect(shipped.map(shipment => shipment.status)).toEqual(Array(CONCURRENT_SHIPMENTS).fill('SHIPPED'));
    expect(elapsed, 'all shipments handled well before the 30 s pool timeout').toBeLessThan(15_000);
    for (const shipment of shipped) parcels.register(shipment);
  });
});
