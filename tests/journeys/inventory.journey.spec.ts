import { test, expect } from '@fixtures';

// Backend 3.22.0 / warehouse-service 1.6.0: warehouse owns the stock ledger. Checkout deducts synchronously
// (backend -> warehouse reservation), a cancel gives the stock back asynchronously:
// backend order.cancelled (with stockRestore) -> event feed -> warehouse ledger -> level push -> backend projection.
test.describe('inventory journeys', { tag: ['@journey', '@inventory', '@orders'] }, () => {
  test('a cancelled order\'s stock comes back through warehouse-service with exactly one ORDER_RESTORED movement',
    { tag: '@slow' }, async ({ shopper, admin }) => {
      // given: two of five units ordered
      const { product } = await shopper.fillCart({ price: 30, stockQuantity: 5 }, 2);
      const order = await shopper.checkout();
      expect(await admin.stockOf(product.id)).toBe(3);
      expect(await admin.movementsOf(product.id)).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'ORDER_DEDUCTED', orderId: order.id, delta: -2, quantityAfter: 3, actor: shopper.username }),
      ]));

      // when
      const response = await shopper.orders.cancel(order.id);

      // then
      await expect(response).toHaveStatus(200);
      expect(((await response.json()) as { status: string }).status).toBe('CANCELLED');
      await admin.waitForStock(product.id, 5);
      expect(await admin.waitForRestoredMovements(product.id, order.id)).toEqual([
        expect.objectContaining({
          productId: product.id,
          orderId: order.id,
          type: 'ORDER_RESTORED',
          delta: 2,
          quantityAfter: 5,
          actor: shopper.username,
          reason: 'Order cancellation',
        }),
      ]);
    });
});
