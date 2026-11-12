import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { TEST_CARDS } from '@api/payments.client';
import { ReturnsAdminClient, ReturnsClient, type ReturnDto } from '@api/returns.client';
import { addresses } from '@support/addresses';
import { InboxReceiver, isSignedWith } from '@support/webhooks';
import { ASYNC_TIMEOUT, POLL_INTERVALS } from '@config';

// Journeys that cross every service: backend (orders, tenders, webhooks, event feed),
// payment-service (cards, refunds from the feed) and warehouse-service (shipping, returns).
test.describe('after-sale journeys', { tag: ['@journey'] }, () => {
  test('cancelling a card-paid order refunds the card through the event feed and tells the webhook', { tag: '@slow' }, async ({ shopper }) => {
    // given
    const inbox = await InboxReceiver.subscribe(shopper, ['order.paid', 'order.cancelled']);
    const { order } = await shopper.placeOrder(120);
    const payment = await shopper.payAndWaitForPaid(order.id);
    await inbox.waitFor('order.paid', order.id);
    expect((await shopper.loyaltyAccount()).balance).toBe(120);
    const requestId = `pw-cancel-${randomUUID()}`;

    // when
    const response = await shopper.orders.cancel(order.id, { 'X-Request-Id': requestId });

    // then
    await expect(response).toHaveStatus(200);
    expect(response.headers()['x-request-id']).toBe(requestId);
    // backend -> domain_events -> payment-service poller -> card refund
    const refunded = await shopper.waitForPaymentStatus(payment.id, 'REFUNDED');
    expect(refunded.refundedAmount).toBe(120);
    // the same request id travels with the event to the webhook delivery
    const cancelled = await inbox.waitFor('order.cancelled', order.id);
    expect(isSignedWith(inbox.secret, cancelled), 'order.cancelled is signed with the subscription secret').toBe(true);
    expect(cancelled.requestId).toBe(requestId);
    expect(cancelled.payload.data).toMatchObject({ orderId: order.id, status: 'CANCELLED' });
    await expect.poll(async () => (await shopper.loyaltyAccount()).balance, { timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS })
      .toBe(0);
  });

  test('a delivered order paid with card, gift card and points is returned and refunded in that order', { tag: '@slow' }, async ({ api, shopper, admin, warehouse }) => {
    // given: points from an earlier order (1 point per full 1.00)
    const { order: earlier } = await shopper.placeOrder(500);
    await shopper.payAndWaitForPaid(earlier.id);
    expect((await shopper.loyaltyAccount()).balance).toBe(500);
    // and: an order for 100.00 paid with a 20.00 gift card, 300 points (3.00) and the card for the rest
    const giftCard = await admin.issueGiftCard({ amount: 20 });
    const { product } = await shopper.fillCart({ price: 100 });
    await expect(await shopper.tenders.applyGiftCard(giftCard.code)).toHaveStatus(200);
    await expect(await shopper.tenders.applyPoints(300)).toHaveStatus(200);
    const order = await shopper.checkout(addresses.germany);
    expect(order).toMatchObject({ totalAmount: 100, giftCardAmount: 20, pointsRedeemed: 300, pointsAmount: 3, amountDue: 77 });
    const payment = await shopper.payAndWaitForPaid(order.id);
    expect(payment.amount).toBe(77);
    const shipment = await warehouse.shipSimulated(order.id);
    await warehouse.advanceUntil(shipment, 'DELIVERED');
    await shopper.waitForOrderStatus(order.id, 'DELIVERED');
    // the 3.00 paid with points earns nothing: 100.00 - 3.00 earns 97 points
    expect((await shopper.loyaltyAccount()).balance).toBe(500 - 300 + 97);

    // when: the customer returns the item and the admin approves, receives and refunds it
    const refund = await test.step('return the item: request, approve, receive and refund', async () => {
      const returns = new ReturnsClient(api.request, shopper.token);
      const returnsAdmin = new ReturnsAdminClient(api.request, await api.getAdminToken());
      const requested = await returns.create(order.id, [{ productId: product.id, quantity: 1 }]);
      await expect(requested).toHaveStatus(201);
      const rma: ReturnDto = await requested.json();
      expect(rma).toMatchObject({ status: 'REQUESTED', estimatedRefund: 100 });
      await expect(await returnsAdmin.approve(rma.id)).toHaveStatus(200);
      await expect(await returnsAdmin.receive(rma.id, [{ productId: product.id, condition: 'RESELLABLE' }])).toHaveStatus(200);
      return returnsAdmin.refund(rma.id);
    });

    // then: card first (77.00), then the gift card (20.00), then points (300 = 3.00)
    await expect(refund).toHaveStatus(200);
    expect(await refund.json()).toMatchObject({ status: 'REFUNDED', refundAmount: 100 });
    const card = await shopper.waitForPaymentStatus(payment.id, 'REFUNDED');
    expect(card.refundedAmount).toBe(77);
    await expect.poll(async () => (await (await shopper.giftCards.balance(giftCard.code)).json()).balance,
      { timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS }).toBe(20);
    // redeemed points come back and the 97 points earned on the refunded order are revoked
    await expect.poll(async () => (await shopper.loyaltyAccount()).balance, { timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS })
      .toBe(500);
    const stored = await shopper.getOrder(order.id);
    expect(stored.refundedAmount).toBe(100);
  });

  test('a timed-out card leaves the order payable and a second card pays it', { tag: '@slow' }, async ({ shopper }) => {
    // given
    const inbox = await InboxReceiver.subscribe(shopper, ['payment.failed', 'order.paid']);
    const { order } = await shopper.placeOrder(60);
    const slow = await shopper.pay(order.id, TEST_CARDS.asyncTimeout);
    expect(slow).toMatchObject({ status: 'PROCESSING', failureCode: null });

    // when
    const failed = await shopper.waitForPaymentStatus(slow.id, 'FAILED');
    const retry = await shopper.payAndWaitForPaid(order.id, TEST_CARDS.mastercard);

    // then
    expect(failed.failureCode).toBe('PROVIDER_TIMEOUT');
    expect(retry).toMatchObject({ status: 'CAPTURED', cardBrand: 'MASTERCARD', cardLast4: '4444', amount: 60 });
    const failedEvent = await inbox.waitFor('payment.failed', order.id);
    expect(isSignedWith(inbox.secret, failedEvent)).toBe(true);
    expect(failedEvent.payload.data).toMatchObject({ orderId: order.id, failureCode: 'PROVIDER_TIMEOUT' });
    await inbox.waitFor('order.paid', order.id);
    const history = await (await shopper.payments.listForOrder(order.id)).json();
    expect(history.map((p: { id: string; status: string }) => [p.id, p.status])).toEqual([
      [retry.id, 'CAPTURED'],
      [slow.id, 'FAILED'],
    ]);
  });

  test('a gift card that covers the whole order pays it without a card and the warehouse can ship it', async ({ shopper, admin, warehouse }) => {
    // given
    const inbox = await InboxReceiver.subscribe(shopper, ['order.paid', 'shipment.shipped', 'shipment.delivered']);
    const giftCard = await admin.issueGiftCard({ amount: 50 });
    await shopper.fillCart({ price: 35 });
    await expect(await shopper.tenders.applyGiftCard(giftCard.code)).toHaveStatus(200);

    // when
    const order = await shopper.checkout();

    // then
    expect(order).toMatchObject({ totalAmount: 35, giftCardAmount: 35, amountDue: 0 });
    await shopper.waitForOrderStatus(order.id, 'PAID');
    expect(await (await shopper.payments.listForOrder(order.id)).json()).toEqual([]);
    expect((await (await shopper.giftCards.balance(giftCard.code)).json()).balance).toBe(15);
    await inbox.waitFor('order.paid', order.id);

    // when
    const shipment = await warehouse.shipSimulated(order.id);
    const tracking = await warehouse.advanceUntil(shipment, 'DELIVERED');

    // then
    expect(tracking.events.map(event => event.status)).toEqual(
      expect.arrayContaining(['LABEL_CREATED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED']),
    );
    await shopper.waitForOrderStatus(order.id, 'DELIVERED');
    const shipped = await inbox.waitFor('shipment.shipped', order.id);
    const delivered = await inbox.waitFor('shipment.delivered', order.id);
    expect(isSignedWith(inbox.secret, shipped) && isSignedWith(inbox.secret, delivered)).toBe(true);
    expect(Date.parse(String(shipped.payload.createdAt))).toBeLessThanOrEqual(Date.parse(String(delivered.payload.createdAt)));
  });
});
