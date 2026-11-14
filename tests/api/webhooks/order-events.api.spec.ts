import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { TEST_CARDS } from '@api/payments.client';
import { addresses } from '@support/addresses';
import { InboxReceiver, UUID_FORMAT, bookReturnRefund, isSignedWith, type ReceivedWebhook } from '@support/webhooks';
import type { OrderDto } from '@models/order';
import type { WebhookEventType } from '@models/webhook';

// Every event delivery carries the same headers and a body {"id","type","createdAt","data"} signed with the subscription secret.
function expectSignedEvent(webhook: ReceivedWebhook, receiver: InboxReceiver, type: WebhookEventType, data: Record<string, unknown>) {
  expect(webhook.raw.headers).toMatchObject({
    'Content-Type': 'application/json',
    'User-Agent': 'AwesomeTesting-Webhooks/1.0',
    'X-Webhook-Event': type,
    'X-Webhook-Id': expect.stringMatching(UUID_FORMAT),
    'X-Webhook-Signature': expect.stringMatching(/^t=\d+,v1=[0-9a-f]{64}$/),
    'X-Request-Id': expect.stringMatching(/^[A-Za-z0-9._-]{1,128}$/),
  });
  expect(webhook.payload).toEqual({
    id: expect.stringMatching(UUID_FORMAT),
    type,
    createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    data,
  });
  expect(isSignedWith(receiver.secret, webhook), `${type} signature verifies with the subscription secret`).toBe(true);
}

test.describe('webhook deliveries of commerce events', { tag: ['@webhooks'] }, () => {
  test('order.created is delivered when the customer checks out', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);

    // when
    const { order } = await shopper.placeOrder(40);

    // then
    const webhook = await receiver.waitFor('order.created', order.id);
    expectSignedEvent(webhook, receiver, 'order.created', { orderId: order.id, status: 'PENDING', totalAmount: 40 });
    const [delivery] = await receiver.deliveries();
    expect(delivery).toMatchObject({ id: webhook.deliveryId, eventId: webhook.payload.id, eventType: 'order.created', status: 'DELIVERED', attempts: 1, lastStatusCode: 200, payload: webhook.raw.body });
  });

  test('order.created carries the X-Request-Id of the checkout request that caused it', async ({ shopper, request }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    await shopper.fillCart({ price: 15 });
    const requestId = `pw-webhooks-${randomUUID()}`;

    // when
    const response = await request.post('/api/v1/orders', {
      data: addresses.poland,
      headers: { Authorization: `Bearer ${shopper.token}`, 'X-Request-Id': requestId },
    });

    // then
    await expect(response).toHaveStatus(201);
    expect(response.headers()['x-request-id']).toBe(requestId);
    const order: OrderDto = await response.json();
    const webhook = await receiver.waitFor('order.created', order.id);
    expect(webhook.requestId).toBe(requestId);
    expect(webhook.raw.headers.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  test('order.paid is delivered once the card payment is captured', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.paid']);
    const { order } = await shopper.placeOrder(25);

    // when
    const payment = await shopper.payAndWaitForPaid(order.id);

    // then
    const webhook = await receiver.waitFor('order.paid', order.id);
    expectSignedEvent(webhook, receiver, 'order.paid', { orderId: order.id, paymentId: payment.id, status: 'PAID', totalAmount: 25 });
  });

  test('payment.failed is delivered for a declined card and the order stays pending', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['payment.failed']);
    const { order } = await shopper.placeOrder(30);

    // when
    const payment = await shopper.pay(order.id, TEST_CARDS.declined);

    // then
    const webhook = await receiver.waitFor('payment.failed', order.id);
    expectSignedEvent(webhook, receiver, 'payment.failed', {
      orderId: order.id, paymentId: payment.id, failureCode: 'CARD_DECLINED', status: 'PENDING', totalAmount: 30,
    });
    expect((await shopper.getOrder(order.id)).status).toBe('PENDING');
  });

  test('order.cancelled is delivered when the customer cancels', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.cancelled']);
    const { order } = await shopper.placeOrder(12.5);

    // when
    const response = await shopper.orders.cancel(order.id);

    // then
    await expect(response).toHaveStatus(200);
    const webhook = await receiver.waitFor('order.cancelled', order.id);
    expectSignedEvent(webhook, receiver, 'order.cancelled', { orderId: order.id, status: 'CANCELLED', totalAmount: 12.5, reason: 'CUSTOMER' });
  });

  test('shipment.shipped and shipment.delivered follow the parcel through the simulated carrier', async ({ shopper, parcels }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['shipment.shipped', 'shipment.delivered']);

    // when
    const parcel = await parcels.shipSimulated(shopper);

    // then
    const shipped = await receiver.waitFor('shipment.shipped', parcel.orderId);
    expectSignedEvent(shipped, receiver, 'shipment.shipped', { orderId: parcel.orderId, status: 'SHIPPED', totalAmount: 25 });

    // when
    await parcels.advanceTo(parcel, 'DELIVERED');

    // then
    const delivered = await receiver.waitFor('shipment.delivered', parcel.orderId);
    expectSignedEvent(delivered, receiver, 'shipment.delivered', { orderId: parcel.orderId, status: 'DELIVERED', totalAmount: 25 });
    expect(delivered.payload.id).not.toBe(shipped.payload.id);
  });

  test('refund.booked is delivered when a returned item is refunded', async ({ shopper, parcels, api }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['refund.booked']);
    const parcel = await parcels.shipSimulated(shopper);
    await parcels.advanceTo(parcel, 'DELIVERED');
    const order = await shopper.waitForOrderStatus(parcel.orderId, 'DELIVERED');

    // when
    const refunded = await bookReturnRefund(api, shopper, order.id, order.items[0].productId);

    // then
    expect(refunded).toBe(25);
    const webhook = await receiver.waitFor('refund.booked', order.id);
    expectSignedEvent(webhook, receiver, 'refund.booked', {
      orderId: order.id, amount: 25, requestId: expect.stringMatching(UUID_FORMAT), status: 'DELIVERED', totalAmount: 25,
    });
  });

  test('only subscribed event types are delivered', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.paid']);
    const { order } = await shopper.placeOrder(20);

    // when
    await shopper.payAndWaitForPaid(order.id);

    // then
    await receiver.waitFor('order.paid', order.id);
    expect((await receiver.requests()).map(webhook => webhook.event)).toEqual(['order.paid']);
    expect((await receiver.deliveries()).map(delivery => delivery.eventType)).toEqual(['order.paid']);
  });

  test('a paused subscription receives nothing while an active one gets the event', async ({ shopper }) => {
    // given
    const paused = await InboxReceiver.subscribe(shopper, ['order.created']);
    const active = await InboxReceiver.subscribe(shopper, ['order.created']);
    const pause = await shopper.webhooks.update(paused.subscription.id, { url: paused.inbox.url, events: ['order.created'], active: false });
    await expect(pause).toHaveStatus(200);

    // when
    const { order } = await shopper.placeOrder();

    // then
    await active.waitFor('order.created', order.id);
    expect(await paused.requests()).toEqual([]);
    expect(await paused.deliveries()).toEqual([]);
  });

  test('another customer\'s subscription does not receive the order\'s events', async ({ shopper, otherShopper }) => {
    // given
    const mine = await InboxReceiver.subscribe(shopper, ['order.created']);
    const theirs = await InboxReceiver.subscribe(otherShopper, ['order.created']);

    // when
    const { order } = await shopper.placeOrder();

    // then
    await mine.waitFor('order.created', order.id);
    expect(await theirs.requests()).toEqual([]);
  });
});
