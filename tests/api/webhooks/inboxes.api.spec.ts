import { test, expect } from '@fixtures';
import { WebhooksClient } from '@api/webhooks.client';
import { createInbox } from '@support/webhooks';
import type { WebhookInboxDto } from '@models/webhook';

const NOT_FOUND = { message: 'Webhook inbox not found' };

test.describe('POST /api/v1/webhook-inboxes', { tag: ['@webhooks'] }, () => {
  test('creates an inbox addressed as inbox://<token> - 201', async ({ shopper }) => {
    // when
    const response = await shopper.webhooks.createInbox();

    // then
    await expect(response).toHaveStatus(201);
    const inbox: WebhookInboxDto = await response.json();
    expect(inbox).toEqual({ token: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/), url: `inbox://${inbox.token}`, createdAt: expect.any(String) });
    expect(await (await shopper.webhooks.inboxes()).json()).toEqual([inbox]);
    expect(await (await shopper.webhooks.inboxRequests(inbox.token)).json()).toEqual([]);
  });

  test('allows at most three inboxes per user - 409', async ({ shopper }) => {
    // given
    for (let i = 0; i < 3; i++) await createInbox(shopper.webhooks);

    // when
    const response = await shopper.webhooks.createInbox();

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'You can have at most 3 webhook inboxes' });
    expect(await (await shopper.webhooks.inboxes()).json()).toHaveLength(3);
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new WebhooksClient(request).createInbox();

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});

test.describe('GET /api/v1/webhook-inboxes', { tag: ['@webhooks'] }, () => {
  test('lists only the caller\'s inboxes, oldest first - 200', async ({ shopper, otherShopper }) => {
    // given
    const first = await createInbox(shopper.webhooks);
    const second = await createInbox(shopper.webhooks);
    await createInbox(otherShopper.webhooks);

    // when
    const response = await shopper.webhooks.inboxes();

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual([first, second]);
  });

  test('returns an empty list for a user without inboxes - 200', async ({ shopper }) => {
    // when
    const response = await shopper.webhooks.inboxes();

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual([]);
  });
});

test.describe('GET /api/v1/webhook-inboxes/{token}/requests', { tag: ['@webhooks'] }, () => {
  test('hides another user\'s inbox as not found - 404', async ({ shopper, otherShopper }) => {
    // given
    const inbox = await createInbox(shopper.webhooks);

    // when
    const response = await otherShopper.webhooks.inboxRequests(inbox.token);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual(NOT_FOUND);
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new WebhooksClient(request).inboxRequests('any-token');

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});

test.describe('DELETE /api/v1/webhook-inboxes/{token}', { tag: ['@webhooks'] }, () => {
  test('deletes the inbox and its requests - 204', async ({ shopper }) => {
    // given
    const inbox = await createInbox(shopper.webhooks);

    // when
    const response = await shopper.webhooks.deleteInbox(inbox.token);

    // then
    await expect(response).toHaveStatus(204);
    expect(await (await shopper.webhooks.inboxes()).json()).toEqual([]);
    await expect(await shopper.webhooks.inboxRequests(inbox.token)).toHaveStatus(404);
  });

  test('refuses to delete another user\'s inbox - 404', async ({ shopper, otherShopper }) => {
    // given
    const inbox = await createInbox(shopper.webhooks);

    // when
    const response = await otherShopper.webhooks.deleteInbox(inbox.token);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual(NOT_FOUND);
    expect(await (await shopper.webhooks.inboxes()).json()).toEqual([inbox]);
  });
});
