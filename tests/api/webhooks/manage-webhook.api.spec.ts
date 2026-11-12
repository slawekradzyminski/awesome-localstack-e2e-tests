import { test, expect } from '@fixtures';
import { WebhooksClient } from '@api/webhooks.client';
import { InboxReceiver, PUBLIC_URL, createInbox, subscribe, withoutSecret } from '@support/webhooks';
import type { WebhookSubscriptionDto } from '@models/webhook';

const NOT_FOUND = { message: 'Webhook subscription not found' };
const NOT_YOURS = { message: "You cannot access someone else's webhook subscription" };

test.describe('GET /api/v1/webhooks', { tag: ['@webhooks'] }, () => {
  test('lists only the caller\'s subscriptions, oldest first, without secrets - 200', async ({ shopper, otherShopper }) => {
    // given
    const first = await subscribe(shopper.webhooks, `${PUBLIC_URL}/first`, ['order.created']);
    const second = await subscribe(shopper.webhooks, `${PUBLIC_URL}/second`, ['order.paid'], 'Second');
    await subscribe(otherShopper.webhooks, `${PUBLIC_URL}/other`, ['order.created']);

    // when
    const response = await shopper.webhooks.list();

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual([withoutSecret(first), withoutSecret(second)]);
  });

  test('returns an empty list for a user without subscriptions - 200', async ({ shopper }) => {
    // when
    const response = await shopper.webhooks.list();

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual([]);
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new WebhooksClient(request).list();

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});

test.describe('GET /api/v1/webhooks/{id}', { tag: ['@webhooks'] }, () => {
  test('returns one subscription without its secret - 200', async ({ shopper }) => {
    // given
    const created = await subscribe(shopper.webhooks, PUBLIC_URL, ['order.cancelled'], 'Cancellations');

    // when
    const response = await shopper.webhooks.getById(created.id);

    // then
    await expect(response).toHaveStatus(200);
    const stored = await response.json();
    expect(stored).toEqual(withoutSecret(created));
    expect(stored).not.toHaveProperty('secret');
  });

  test('refuses another user\'s subscription - 403', async ({ shopper, otherShopper }) => {
    // given
    const created = await subscribe(shopper.webhooks, PUBLIC_URL, ['order.created']);

    // when
    const response = await otherShopper.webhooks.getById(created.id);

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual(NOT_YOURS);
  });

  test('returns not found for an unknown subscription - 404', async ({ shopper }) => {
    // when
    const response = await shopper.webhooks.getById(2_147_483_647);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual(NOT_FOUND);
  });
});

test.describe('PUT /api/v1/webhooks/{id}', { tag: ['@webhooks'] }, () => {
  test('replaces url, events and description and keeps the secret - 200', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    const inbox = await createInbox(shopper.webhooks);

    // when
    const response = await shopper.webhooks.update(receiver.subscription.id, {
      url: inbox.url, events: ['webhook.ping', 'order.paid'], description: 'Moved',
    });

    // then
    await expect(response).toHaveStatus(200);
    const updated: WebhookSubscriptionDto = await response.json();
    expect(updated).toEqual({
      ...withoutSecret(receiver.subscription),
      url: inbox.url,
      events: ['webhook.ping', 'order.paid'],
      description: 'Moved',
      updatedAt: expect.any(String),
    });
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(receiver.subscription.updatedAt));
    expect(await (await shopper.webhooks.getById(updated.id)).json()).toEqual(updated);
  });

  test('pauses deliveries with active=false and keeps them paused when active is omitted - 200', async ({ shopper }) => {
    // given
    const created = await subscribe(shopper.webhooks, PUBLIC_URL, ['order.created'], 'Pausable');

    // when
    const paused = await shopper.webhooks.update(created.id, { url: PUBLIC_URL, events: ['order.created'], active: false });
    const edited = await shopper.webhooks.update(created.id, { url: PUBLIC_URL, events: ['order.created'], description: null });

    // then
    await expect(paused).toHaveStatus(200);
    expect(await paused.json()).toMatchObject({ active: false, description: null });
    await expect(edited).toHaveStatus(200);
    expect(await (await shopper.webhooks.getById(created.id)).json()).toMatchObject({ active: false, consecutiveFailures: 0, disabledReason: null });
  });

  test('re-enables a paused subscription with active=true - 200', async ({ shopper }) => {
    // given
    const created = await subscribe(shopper.webhooks, PUBLIC_URL, ['order.created']);
    await shopper.webhooks.update(created.id, { url: PUBLIC_URL, events: ['order.created'], active: false });

    // when
    const response = await shopper.webhooks.update(created.id, { url: PUBLIC_URL, events: ['order.created'], active: true });

    // then
    await expect(response).toHaveStatus(200);
    expect(await (await shopper.webhooks.getById(created.id)).json()).toMatchObject({ active: true, consecutiveFailures: 0 });
  });

  test('checks the new URL with the SSRF guard and leaves the subscription unchanged - 400', async ({ shopper }) => {
    // given
    const created = await subscribe(shopper.webhooks, PUBLIC_URL, ['order.created']);

    // when
    const response = await shopper.webhooks.update(created.id, { url: 'http://169.254.169.254/latest/meta-data', events: ['order.created'] });

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({
      message: 'Webhook URL rejected: Host 169.254.169.254 resolves to a link-local address; webhooks can only call public addresses',
    });
    expect(await (await shopper.webhooks.getById(created.id)).json()).toEqual(withoutSecret(created));
  });

  test('validates the body like create - 400', async ({ shopper }) => {
    // given
    const created = await subscribe(shopper.webhooks, PUBLIC_URL, ['order.created']);

    // when
    const response = await shopper.webhooks.update(created.id, { url: '', events: [] });

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ url: 'URL is required', events: 'At least one event type is required' });
  });

  test('refuses another user\'s subscription - 403', async ({ shopper, otherShopper }) => {
    // given
    const created = await subscribe(shopper.webhooks, PUBLIC_URL, ['order.created']);

    // when
    const response = await otherShopper.webhooks.update(created.id, { url: `${PUBLIC_URL}/hijack`, events: ['order.created'] });

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual(NOT_YOURS);
    expect((await (await shopper.webhooks.getById(created.id)).json()).url).toBe(PUBLIC_URL);
  });

  test('returns not found for an unknown subscription - 404', async ({ shopper }) => {
    // when
    const response = await shopper.webhooks.update(2_147_483_647, { url: PUBLIC_URL, events: ['order.created'] });

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual(NOT_FOUND);
  });
});

test.describe('DELETE /api/v1/webhooks/{id}', { tag: ['@webhooks'] }, () => {
  test('deletes the subscription and its delivery log - 204', async ({ shopper }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    await expect(await shopper.webhooks.ping(receiver.subscription.id)).toHaveStatus(201);

    // when
    const response = await shopper.webhooks.remove(receiver.subscription.id);

    // then
    await expect(response).toHaveStatus(204);
    await expect(await shopper.webhooks.getById(receiver.subscription.id)).toHaveStatus(404);
    await expect(await shopper.webhooks.deliveries(receiver.subscription.id)).toHaveStatus(404);
    expect(await (await shopper.webhooks.list()).json()).toEqual([]);
  });

  test('refuses another user\'s subscription and keeps it - 403', async ({ shopper, otherShopper }) => {
    // given
    const created = await subscribe(shopper.webhooks, PUBLIC_URL, ['order.created']);

    // when
    const response = await otherShopper.webhooks.remove(created.id);

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual(NOT_YOURS);
    await expect(await shopper.webhooks.getById(created.id)).toHaveStatus(200);
  });

  test('returns not found for an unknown subscription - 404', async ({ shopper }) => {
    // when
    const response = await shopper.webhooks.remove(2_147_483_647);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual(NOT_FOUND);
  });
});
