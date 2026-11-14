import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { OrdersClient } from '@api/orders.client';
import { TEST_CARDS } from '@api/payments.client';
import { InboxReceiver, isSignedWith } from '@support/webhooks';
import type { OrderDto } from '@models/order';
import type { PageDto } from '@models/page';

// Backend 3.21.0: stock deducted at checkout is a hold that ends at reservationExpiresAt (ORDERS_RESERVATION_TTL,
// 30 minutes in the stacks). POST /api/v1/admin/orders/{id}/expire-reservation ends it now, as the expiry job would.
const RESERVATION_TTL_MS = 30 * 60 * 1000;
const UTC_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

test.describe('Order reservations', { tag: ['@orders', '@reservations'] }, () => {
  test('a new order holds its stock for 30 minutes, the same deadline in every read - 201', async ({ shopper, admin }) => {
    // given
    const before = Date.now();

    // when
    const { order } = await shopper.placeOrder(40);

    // then
    expect(order.status).toBe('PENDING');
    expect(order.reservationExpiresAt).toMatch(UTC_MILLIS);
    const deadline = Date.parse(order.reservationExpiresAt!);
    expect(deadline).toBeGreaterThanOrEqual(before + RESERVATION_TTL_MS - 5_000);
    expect(deadline).toBeLessThanOrEqual(Date.now() + RESERVATION_TTL_MS + 5_000);
    expect((await shopper.getOrder(order.id)).reservationExpiresAt).toBe(order.reservationExpiresAt);
    const mine: PageDto<OrderDto> = await (await shopper.orders.getMine()).json();
    expect(mine.content.find(listed => listed.id === order.id)?.reservationExpiresAt).toBe(order.reservationExpiresAt);
    const all: PageDto<OrderDto> = await (await admin.orders.getAll({ status: 'PENDING', size: 100 })).json();
    expect(all.content.find(listed => listed.id === order.id)?.reservationExpiresAt).toBe(order.reservationExpiresAt);
  });

  test('expiring the reservation cancels the order and puts the stock back - 200', async ({ shopper, admin }) => {
    // given
    const { order, product } = await shopper.placeOrder(25);
    const held = await admin.stockOf(product.id);

    // when
    const response = await admin.orders.expireReservation(order.id);

    // then
    await expect(response).toHaveStatus(200);
    const expired: OrderDto = await response.json();
    expect(expired).toMatchObject({ id: order.id, status: 'CANCELLED' });
    expect(Date.parse(expired.reservationExpiresAt!)).toBeLessThan(Date.parse(order.reservationExpiresAt!));
    expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'CANCELLED', reservationExpiresAt: expired.reservationExpiresAt });
    // warehouse-service restores the stock from the order.cancelled event (backend 3.22.0, asynchronous)
    await admin.waitForStock(product.id, held + 1);
    expect(await admin.waitForRestoredMovements(product.id, order.id)).toEqual([
      expect.objectContaining({ orderId: order.id, type: 'ORDER_RESTORED', delta: 1, quantityAfter: held + 1, actor: 'system' }),
    ]);
  });

  test('a payment started after the reservation expired is refused - 409', async ({ shopper, admin }) => {
    // given
    const { order } = await shopper.placeOrder(25);
    await expect(await admin.orders.expireReservation(order.id), 'Expire the reservation').toHaveStatus(200);

    // when
    const response = await shopper.payments.pay(order.id);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Order is not payable' });
  });

  test('a capture that arrives after the reservation expired is voided', async ({ shopper, admin }) => {
    // given: a 3-D Secure payment waiting for the customer
    const { order } = await shopper.placeOrder(60);
    const payment = await shopper.pay(order.id, TEST_CARDS.threeDs);
    expect(payment.status).toBe('REQUIRES_ACTION');
    await expect(await admin.orders.expireReservation(order.id), 'Expire the reservation').toHaveStatus(200);

    // when: the customer completes 3-D Secure too late
    const response = await shopper.payments.submit3ds(payment.id);

    // then: the backend refuses the capture and payment-service voids it
    await expect(response).toHaveStatus(200);
    const voided = await shopper.waitForPaymentStatus(payment.id, 'VOIDED');
    expect(voided).toMatchObject({ failureCode: 'ORDER_NOT_PAYABLE', refundedAmount: 60 });
    expect((await shopper.getOrder(order.id)).status).toBe('CANCELLED');
  });

  test('the reservation-expired webhook reaches the customer\'s inbox with the request id', { tag: '@webhooks' }, async ({ shopper, admin }) => {
    // given
    const inbox = await InboxReceiver.subscribe(shopper, ['order.cancelled', 'order.reservation-expired']);
    const { order } = await shopper.placeOrder(45);
    const requestId = `pw-expire-${randomUUID()}`;

    // when
    const response = await admin.orders.expireReservation(order.id, { 'X-Request-Id': requestId });

    // then
    await expect(response).toHaveStatus(200);
    const expired: OrderDto = await response.json();
    const delivered = await inbox.waitFor('order.reservation-expired', order.id);
    expect(isSignedWith(inbox.secret, delivered), 'order.reservation-expired is signed with the subscription secret').toBe(true);
    expect(delivered.payload).toMatchObject({ type: 'order.reservation-expired' });
    expect(delivered.payload.data).toEqual({ orderId: order.id, expiredAt: expired.reservationExpiresAt, totalAmount: 45 });
    expect(delivered.requestId).toBe(requestId);
    const cancelled = await inbox.waitFor('order.cancelled', order.id);
    expect(cancelled.payload.data).toMatchObject({ orderId: order.id, status: 'CANCELLED', reason: 'RESERVATION_EXPIRED' });
  });

  test('only a PENDING order holds a reservation - 409', async ({ shopper, admin }) => {
    // given
    const { order } = await shopper.placeOrder(25);
    await shopper.payAndWaitForPaid(order.id);

    // when
    const response = await admin.orders.expireReservation(order.id);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Only PENDING orders hold a reservation; order is PAID' });
  });

  test('an unknown order cannot be expired - 404', async ({ admin }) => {
    // when
    const response = await admin.orders.expireReservation(2_000_000_000);

    // then
    await expect(response).toHaveStatus(404);
  });

  test('customers cannot expire reservations - 403', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(25);

    // when
    const response = await new OrdersClient(shopper.api.request, shopper.token).expireReservation(order.id);

    // then
    await expect(response).toHaveStatus(403);
    expect((await shopper.getOrder(order.id)).status).toBe('PENDING');
  });
});
