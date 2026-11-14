import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import type { PurchaseOrderDto } from '@models/inventory';

// warehouse-service 1.6.0 books goods receipts in its own stock ledger (PURCHASE_RECEIVED) and pushes the new
// level to the backend, whose product stockQuantity follows asynchronously.
test.describe('POST /api/v1/admin/purchase-orders/{id}/receipts - stock ledger', { tag: ['@inventory', '@admin'] }, () => {
  test('a goods receipt raises the product\'s stock in the ledger and, shortly after, in the catalogue - 200',
    async ({ api, admin }) => {
      // given
      const product = await api.createProduct({ stockQuantity: 2 });
      const purchaseOrder = await admin.submittedPurchaseOrder(product.id, 5);
      const requestId = randomUUID();

      // when
      const response = await admin.purchasing.receive(purchaseOrder.id, { requestId, lines: [{ productId: product.id, quantity: 5 }] });

      // then
      await expect(response).toHaveStatus(200);
      const received: PurchaseOrderDto = await response.json();
      expect(received.status).toBe('RECEIVED');
      expect(received.lines).toEqual([expect.objectContaining({ productId: product.id, receivedQuantity: 5, outstandingQuantity: 0 })]);
      await admin.waitForStock(product.id, 7);
      // the ledger keeps the backend's former receipt fields: warehouse-service as actor, the order as reason
      expect((await admin.movementsOf(product.id))[0]).toMatchObject({
        productId: product.id,
        type: 'PURCHASE_RECEIVED',
        delta: 5,
        quantityAfter: 7,
        actor: 'warehouse-service',
        reason: `Purchase order #${purchaseOrder.id}`,
      });
    });
});
