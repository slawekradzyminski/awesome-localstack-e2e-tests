import { test, expect } from '@fixtures';
import { WebhooksClient } from '@api/webhooks.client';
import { PUBLIC_URL, subscribe, withoutSecret } from '@support/webhooks';
import type { PageDto } from '@models/page';
import type { WebhookSubscriptionDto } from '@models/webhook';


test.describe('GET /api/v1/admin/webhooks', { tag: ['@webhooks'] }, () => {
  test('lists one user\'s subscriptions by id when filtered by username, without secrets - 200', async ({ admin, shopper, otherShopper }) => {
    // given
    const first = await subscribe(shopper.webhooks, `${PUBLIC_URL}/a`, ['order.created']);
    const second = await subscribe(shopper.webhooks, `${PUBLIC_URL}/b`, ['refund.booked'], 'Refunds');
    await subscribe(otherShopper.webhooks, `${PUBLIC_URL}/c`, ['order.created']);

    // when
    const response = await admin.webhooks.listAll({ username: shopper.username });

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({
      content: [withoutSecret(first), withoutSecret(second)],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 2,
      totalPages: 1,
    });
  });

  test('pages through a user\'s subscriptions - 200', async ({ admin, shopper }) => {
    // given
    await subscribe(shopper.webhooks, `${PUBLIC_URL}/1`, ['order.created']);
    const second = await subscribe(shopper.webhooks, `${PUBLIC_URL}/2`, ['order.created']);

    // when
    const response = await admin.webhooks.listAll({ username: ` ${shopper.username} `, page: 1, size: 1 });

    // then
    await expect(response).toHaveStatus(200);
    const page: PageDto<WebhookSubscriptionDto> = await response.json();
    expect(page).toEqual({ content: [withoutSecret(second)], pageNumber: 1, pageSize: 1, totalElements: 2, totalPages: 2 });
  });

  test('lists every user\'s subscriptions without a filter - 200', async ({ admin, shopper }) => {
    // given
    const created = await subscribe(shopper.webhooks, PUBLIC_URL, ['order.created']);

    // when
    const response = await admin.webhooks.listAll({ size: 1 });

    // then
    await expect(response).toHaveStatus(200);
    const page: PageDto<WebhookSubscriptionDto> = await response.json();
    expect(page).toMatchObject({ pageNumber: 0, pageSize: 1, totalElements: expect.any(Number) });
    expect(page.totalElements).toBeGreaterThanOrEqual(1);
    expect(page.content[0]).not.toHaveProperty('secret');
    const last: PageDto<WebhookSubscriptionDto> = await (await admin.webhooks.listAll({ username: shopper.username })).json();
    expect(last.content).toEqual([withoutSecret(created)]);
  });

  test('returns an empty page for a user without subscriptions - 200', async ({ admin, shopper }) => {
    // when
    const response = await admin.webhooks.listAll({ username: shopper.username });

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ content: [], pageNumber: 0, pageSize: 20, totalElements: 0, totalPages: 0 });
  });

  test('forbids a customer - 403', async ({ shopper }) => {
    // when
    const response = await shopper.webhooks.listAll({ username: shopper.username });

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: 'Access denied' });
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new WebhooksClient(request).listAll();

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});
