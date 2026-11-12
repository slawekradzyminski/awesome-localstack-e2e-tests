import { test, expect } from '@fixtures';
import { WebhooksClient } from '@api/webhooks.client';
import { InboxReceiver, UUID_FORMAT, isSignedWith, PUBLIC_URL, subscribe } from '@support/webhooks';
import { parseSignature } from '@support/webhook-signature';
import type { WebhookDeliveryDto } from '@models/webhook';

test.describe('POST /api/v1/webhooks/{id}/test', { tag: ['@webhooks'] }, () => {
  test('sends a signed webhook.ping that lands in the inbox and is logged as delivered - 201', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);

    // when
    const response = await shopper.webhooks.ping(receiver.subscription.id);

    // then
    await expect(response).toHaveStatus(201);
    const delivery: WebhookDeliveryDto = await response.json();
    expect(delivery).toEqual({
      id: expect.stringMatching(UUID_FORMAT),
      subscriptionId: receiver.subscription.id,
      eventId: expect.stringMatching(UUID_FORMAT),
      eventType: 'webhook.ping',
      status: 'DELIVERED',
      attempts: 1,
      nextAttemptAt: null,
      lastStatusCode: 200,
      lastError: null,
      responseSnippet: '{"received":true}',
      durationMs: expect.any(Number),
      payload: expect.any(String),
      createdAt: expect.any(String),
      deliveredAt: expect.any(String),
    });
    expect(JSON.parse(delivery.payload)).toEqual({
      id: delivery.eventId,
      type: 'webhook.ping',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      data: { message: 'Webhook test from Awesome Testing', subscriptionId: receiver.subscription.id },
    });

    const [received] = await receiver.waitForCount(1);
    expect(received.raw.body).toBe(delivery.payload);
    expect(received.raw.headers).toEqual({
      'Content-Type': 'application/json',
      'User-Agent': 'AwesomeTesting-Webhooks/1.0',
      'X-Webhook-Id': delivery.id,
      'X-Webhook-Event': 'webhook.ping',
      'X-Webhook-Signature': expect.stringMatching(/^t=\d+,v1=[0-9a-f]{64}$/),
      'X-Request-Id': expect.stringMatching(/^[A-Za-z0-9._-]{1,128}$/),
      traceparent: expect.stringMatching(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/),
    });
    expect(Math.abs(Number(parseSignature(received.signature!).t) - Date.now() / 1000)).toBeLessThan(300);
    expect(isSignedWith(receiver.secret, received)).toBe(true);
    expect((await receiver.deliveries()).map(logged => logged.id)).toEqual([delivery.id]);
  });

  test('a signature does not verify with a different secret or a changed body', async ({ shopper, otherShopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    const other = await InboxReceiver.subscribe(otherShopper, ['order.created']);
    await expect(await shopper.webhooks.ping(receiver.subscription.id)).toHaveStatus(201);

    // when
    const [received] = await receiver.waitForCount(1);

    // then
    expect(isSignedWith(receiver.secret, received)).toBe(true);
    expect(isSignedWith(other.secret, received)).toBe(false);
    expect(isSignedWith(receiver.secret, { ...received, raw: { ...received.raw, body: received.raw.body.replace('Awesome', 'Evil') } })).toBe(false);
  });

  test('records a failed delivery when the target inbox was deleted - 201', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    await expect(await shopper.webhooks.deleteInbox(receiver.inbox.token)).toHaveStatus(204);

    // when
    const response = await shopper.webhooks.ping(receiver.subscription.id);

    // then
    await expect(response).toHaveStatus(201);
    const delivery: WebhookDeliveryDto = await response.json();
    expect(delivery).toMatchObject({ status: 'FAILED', attempts: 1, lastStatusCode: null, lastError: 'Webhook inbox not found', nextAttemptAt: null, deliveredAt: null });
    expect(await (await shopper.webhooks.delivery(receiver.subscription.id, delivery.id)).json()).toEqual(delivery);
    expect(await (await shopper.webhooks.getById(receiver.subscription.id)).json()).toMatchObject({ active: true, consecutiveFailures: 1 });
  });

  test('refuses to ping a paused subscription - 409', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    await shopper.webhooks.update(receiver.subscription.id, { url: receiver.inbox.url, events: ['order.created'], active: false });

    // when
    const response = await shopper.webhooks.ping(receiver.subscription.id);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Webhook subscription is disabled; enable it with PUT first' });
    expect(await receiver.requests()).toEqual([]);
    expect(await receiver.deliveries()).toEqual([]);
  });

  test('refuses to ping another user\'s subscription - 403', async ({ shopper, otherShopper }) => {
    // given
    const created = await subscribe(shopper.webhooks, PUBLIC_URL, ['order.created']);

    // when
    const response = await otherShopper.webhooks.ping(created.id);

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: "You cannot access someone else's webhook subscription" });
  });

  test('returns not found for an unknown subscription - 404', async ({ shopper }) => {
    // when
    const response = await shopper.webhooks.ping(2_147_483_647);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Webhook subscription not found' });
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new WebhooksClient(request).ping(1);

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});

test.describe('POST /api/v1/webhooks/{id}/rotate-secret', { tag: ['@webhooks'] }, () => {
  test('returns a new secret once and signs later deliveries only with it - 200', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    const oldSecret = receiver.secret;

    // when
    const response = await shopper.webhooks.rotateSecret(receiver.subscription.id);

    // then
    await expect(response).toHaveStatus(200);
    const rotated = await response.json();
    expect(rotated).toMatchObject({ id: receiver.subscription.id, secret: expect.stringMatching(/^whsec_/) });
    expect(rotated.secret).not.toBe(oldSecret);
    expect(await (await shopper.webhooks.getById(receiver.subscription.id)).json()).not.toHaveProperty('secret');

    await expect(await shopper.webhooks.ping(receiver.subscription.id)).toHaveStatus(201);
    const [received] = await receiver.waitForCount(1);
    expect(isSignedWith(rotated.secret, received)).toBe(true);
    expect(isSignedWith(oldSecret, received)).toBe(false);
  });

  test('refuses another user\'s subscription - 403', async ({ shopper, otherShopper }) => {
    // given
    const created = await subscribe(shopper.webhooks, PUBLIC_URL, ['order.created']);

    // when
    const response = await otherShopper.webhooks.rotateSecret(created.id);

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: "You cannot access someone else's webhook subscription" });
  });

  test('returns not found for an unknown subscription - 404', async ({ shopper }) => {
    // when
    const response = await shopper.webhooks.rotateSecret(2_147_483_647);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Webhook subscription not found' });
  });
});
