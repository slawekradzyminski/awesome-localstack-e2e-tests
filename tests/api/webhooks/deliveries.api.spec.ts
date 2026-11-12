import { test, expect } from '@fixtures';
import { WebhooksClient } from '@api/webhooks.client';
import { InboxReceiver, isSignedWith } from '@support/webhooks';
import type { PageDto } from '@models/page';
import type { WebhookDeliveryDto } from '@models/webhook';

async function pingDelivered(receiver: InboxReceiver, webhooks: WebhooksClient): Promise<WebhookDeliveryDto> {
  const response = await webhooks.ping(receiver.subscription.id);
  await expect(response, 'Send a test ping').toHaveStatus(201);
  return response.json();
}

test.describe('GET /api/v1/webhooks/{id}/deliveries', { tag: ['@webhooks'] }, () => {
  test('lists deliveries newest first with paging - 200', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    const first = await pingDelivered(receiver, shopper.webhooks);
    const second = await pingDelivered(receiver, shopper.webhooks);

    // when
    const response = await shopper.webhooks.deliveries(receiver.subscription.id, { page: 0, size: 1 });

    // then
    await expect(response).toHaveStatus(200);
    const page: PageDto<WebhookDeliveryDto> = await response.json();
    expect(page).toEqual({ content: [second], pageNumber: 0, pageSize: 1, totalElements: 2, totalPages: 2 });
    expect((await (await shopper.webhooks.deliveries(receiver.subscription.id, { page: 1, size: 1 })).json()).content).toEqual([first]);
  });

  test('filters deliveries by status - 200', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    const delivered = await pingDelivered(receiver, shopper.webhooks);
    await shopper.webhooks.deleteInbox(receiver.inbox.token);
    const failed = await pingDelivered(receiver, shopper.webhooks);

    // when
    const onlyFailed = await shopper.webhooks.deliveries(receiver.subscription.id, { status: 'FAILED' });
    const onlyDelivered = await shopper.webhooks.deliveries(receiver.subscription.id, { status: 'DELIVERED' });

    // then
    await expect(onlyFailed).toHaveStatus(200);
    expect((await onlyFailed.json()).content).toEqual([failed]);
    expect((await onlyDelivered.json()).content).toEqual([delivered]);
  });

  test('rejects an unknown status filter - 400', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);

    // when
    const response = await shopper.webhooks.deliveries(receiver.subscription.id, { status: 'LOST' });

    // then
    await expect(response).toHaveStatus(400);
    // backend 3.18.0 (T-006) names the parameter and the allowed values instead of the Java enum class
    expect(await response.json()).toEqual({ error: "Unknown status 'LOST'. Allowed values: PENDING, DELIVERED, FAILED" });
  });

  test('refuses another user\'s delivery log - 403', async ({ shopper, otherShopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);

    // when
    const response = await otherShopper.webhooks.deliveries(receiver.subscription.id);

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: "You cannot access someone else's webhook subscription" });
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new WebhooksClient(request).deliveries(1);

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});

test.describe('GET /api/v1/webhooks/{id}/deliveries/{deliveryId}', { tag: ['@webhooks'] }, () => {
  test('returns one delivery with its payload and response - 200', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    const delivery = await pingDelivered(receiver, shopper.webhooks);

    // when
    const response = await shopper.webhooks.delivery(receiver.subscription.id, delivery.id);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual(delivery);
  });

  test('does not show a delivery through another subscription of the same user - 404', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    const otherSubscription = await InboxReceiver.subscribe(shopper, ['order.paid']);
    const delivery = await pingDelivered(receiver, shopper.webhooks);

    // when
    const response = await shopper.webhooks.delivery(otherSubscription.subscription.id, delivery.id);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Webhook delivery not found' });
  });

  test('rejects a delivery id that is not a UUID - 400', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);

    // when
    const response = await shopper.webhooks.delivery(receiver.subscription.id, 'not-a-uuid');

    // then
    await expect(response).toHaveStatus(400);
    // backend 3.18.0 (T-006) names the parameter instead of echoing the parser message
    expect(await response.json()).toEqual({ error: "Invalid deliveryId 'not-a-uuid': must be a valid UUID" });
  });

  test('refuses another user\'s delivery - 403', async ({ shopper, otherShopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    const delivery = await pingDelivered(receiver, shopper.webhooks);

    // when
    const response = await otherShopper.webhooks.delivery(receiver.subscription.id, delivery.id);

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: "You cannot access someone else's webhook subscription" });
  });
});

test.describe('POST /api/v1/webhooks/{id}/deliveries/{deliveryId}/redeliver', { tag: ['@webhooks'] }, () => {
  test('sends the same event again as a new, freshly signed delivery - 201', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    const original = await pingDelivered(receiver, shopper.webhooks);
    await receiver.waitForCount(1);

    // when
    const response = await shopper.webhooks.redeliver(receiver.subscription.id, original.id);

    // then
    await expect(response).toHaveStatus(201);
    const redelivery: WebhookDeliveryDto = await response.json();
    expect(redelivery).toMatchObject({
      subscriptionId: receiver.subscription.id,
      eventId: original.eventId,
      eventType: 'webhook.ping',
      payload: original.payload,
      status: 'DELIVERED',
      attempts: 1,
      lastStatusCode: 200,
    });
    expect(redelivery.id).not.toBe(original.id);

    const [latest, earlier] = await receiver.waitForCount(2);
    expect(latest.deliveryId).toBe(redelivery.id);
    expect(earlier.deliveryId).toBe(original.id);
    expect(latest.raw.body).toBe(earlier.raw.body);
    expect(latest.payload.id).toBe(original.eventId);
    expect(isSignedWith(receiver.secret, latest)).toBe(true);
    expect(await (await shopper.webhooks.delivery(receiver.subscription.id, original.id)).json()).toEqual(original);
    expect((await receiver.deliveries()).map(delivery => delivery.id)).toEqual([redelivery.id, original.id]);
  });

  test('refuses to redeliver through a paused subscription - 409', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    const original = await pingDelivered(receiver, shopper.webhooks);
    await shopper.webhooks.update(receiver.subscription.id, { url: receiver.inbox.url, events: ['order.created'], active: false });

    // when
    const response = await shopper.webhooks.redeliver(receiver.subscription.id, original.id);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Webhook subscription is disabled; enable it with PUT first' });
    expect(await receiver.deliveries()).toHaveLength(1);
  });

  test('returns not found for an unknown delivery - 404', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);

    // when
    const response = await shopper.webhooks.redeliver(receiver.subscription.id, '00000000-0000-0000-0000-000000000000');

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Webhook delivery not found' });
  });

  test('refuses another user\'s delivery - 403', async ({ shopper, otherShopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    const original = await pingDelivered(receiver, shopper.webhooks);

    // when
    const response = await otherShopper.webhooks.redeliver(receiver.subscription.id, original.id);

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: "You cannot access someone else's webhook subscription" });
    expect(await receiver.deliveries()).toHaveLength(1);
  });
});
