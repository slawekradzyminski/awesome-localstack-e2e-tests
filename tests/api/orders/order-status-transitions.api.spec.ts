import { test, expect } from '@fixtures';
import type { OrderDto, OrderStatus } from '@models/order';
import type { ProductDto } from '@models/product';
import type { ApiTestContext } from '@support/api-test-context';

// T-024: order statuses only move forward (steps may be skipped); DELIVERED and CANCELLED are terminal.
test.describe('PUT /api/v1/orders/{id}/status - forward-only transitions', { tag: ['@orders'] }, () => {
  test('a cancelled order cannot be set back to PAID and its stock is not taken again - 400', async ({ api, shopper, admin }) => {
    // given
    const { order, product } = await shopper.placeOrder(30);
    await expect(await admin.orders.updateStatus(order.id, 'CANCELLED'), 'Cancel the order').toHaveStatus(200);
    const stockAfterCancel = await stockOf(api, product);

    // when
    const response = await admin.orders.updateStatus(order.id, 'PAID');

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Cannot change order status from CANCELLED to PAID' });
    expect((await shopper.getOrder(order.id)).status).toBe('CANCELLED');
    expect(await stockOf(api, product)).toBe(stockAfterCancel);
  });

  const backward: [OrderStatus, OrderStatus][] = [
    ['PAID', 'PENDING'],
    ['SHIPPED', 'PAID'],
    ['DELIVERED', 'SHIPPED'],
    ['DELIVERED', 'PENDING'],
  ];
  for (const [reached, target] of backward) {
    test(`${reached} cannot go back to ${target} - 400`, async ({ shopper, admin }) => {
      // given
      const { order } = await shopper.placeOrder(12);
      await expect(await admin.orders.updateStatus(order.id, reached), `Set ${reached}`).toHaveStatus(200);

      // when
      const response = await admin.orders.updateStatus(order.id, target);

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual({ message: `Cannot change order status from ${reached} to ${target}` });
      expect((await shopper.getOrder(order.id)).status).toBe(reached);
    });
  }

  test('a forward step may skip statuses and the current status is a no-op - 200', async ({ shopper, admin }) => {
    // given
    const { order } = await shopper.placeOrder(12);

    // when
    const shipped = await admin.orders.updateStatus(order.id, 'SHIPPED');
    const again = await admin.orders.updateStatus(order.id, 'SHIPPED');
    const delivered = await admin.orders.updateStatus(order.id, 'DELIVERED');

    // then
    await expect(shipped).toHaveStatus(200);
    await expect(again).toHaveStatus(200);
    await expect(delivered).toHaveStatus(200);
    expect(((await delivered.json()) as OrderDto).status).toBe('DELIVERED');
  });

  test('payment and warehouse still move a paid order forward, and it cannot be reopened afterwards - 200/400',
    { tag: ['@slow'] }, async ({ shopper, admin, parcels }) => {
      // given
      const parcel = await parcels.shipSimulated(shopper);
      await shopper.waitForOrderStatus(parcel.orderId, 'SHIPPED');
      await parcels.advanceTo(parcel, 'DELIVERED');

      // when
      const delivered = await shopper.waitForOrderStatus(parcel.orderId, 'DELIVERED');
      const reopened = await admin.orders.updateStatus(parcel.orderId, 'PAID');

      // then
      expect(delivered.fulfilmentState).toBe('DELIVERED');
      await expect(reopened).toHaveStatus(400);
      expect(await reopened.json()).toEqual({ message: 'Cannot change order status from DELIVERED to PAID' });
    });
});

// T-025: a mutation answers with the state it persisted.
test.describe('Order mutations - response matches the stored order', { tag: ['@orders'] }, () => {
  test('cancel answers with the persisted updatedAt - 200', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(15);

    // when
    const response = await shopper.orders.cancel(order.id);

    // then
    await expect(response).toHaveStatus(200);
    const cancelled: OrderDto = await response.json();
    expect(cancelled.updatedAt).not.toBe(order.updatedAt);
    expect(cancelled.updatedAt).toBe((await shopper.getOrder(order.id)).updatedAt);
  });

  test('an admin status change answers with the persisted updatedAt - 200', async ({ shopper, admin }) => {
    // given
    const { order } = await shopper.placeOrder(15);

    // when
    const response = await admin.orders.updateStatus(order.id, 'SHIPPED');

    // then
    await expect(response).toHaveStatus(200);
    const shipped: OrderDto = await response.json();
    expect(shipped.updatedAt).not.toBe(order.updatedAt);
    expect(shipped.updatedAt).toBe((await shopper.getOrder(order.id)).updatedAt);
  });
});

async function stockOf(api: ApiTestContext, product: ProductDto): Promise<number> {
  const response = await (await api.adminProducts()).getById(product.id);
  await expect(response, `Read product ${product.id}`).toHaveStatus(200);
  return ((await response.json()) as ProductDto).stockQuantity;
}
