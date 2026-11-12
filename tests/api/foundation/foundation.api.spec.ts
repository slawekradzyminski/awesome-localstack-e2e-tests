import { test, expect } from '@fixtures';

// Guards the shared helpers every other spec builds on: if this fails, look at the stack, not the feature specs.
test.describe('test foundation', { tag: ['@smoke'] }, () => {
  test('a shopper buys, pays and the warehouse delivers through the simulated carrier', async ({ shopper, warehouse }) => {
    // given
    const { order } = await shopper.placeOrder(40);
    expect(order).toMatchObject({ status: 'PENDING', totalAmount: 40 });

    // when
    await shopper.payAndWaitForPaid(order.id);
    const shipment = await warehouse.shipSimulated(order.id);
    const tracking = await warehouse.advanceUntil(shipment, 'DELIVERED');

    // then
    expect(tracking.simulated).toBe(true);
    await shopper.waitForOrderStatus(order.id, 'DELIVERED');
  });
});
