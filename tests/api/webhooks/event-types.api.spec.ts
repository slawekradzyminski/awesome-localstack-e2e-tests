import { test, expect } from '@fixtures';
import { WebhooksClient } from '@api/webhooks.client';

test.describe('GET /api/v1/webhooks/event-types', { tag: ['@webhooks'] }, () => {
  test('lists every event a subscription can receive, with the test ping last - 200', async ({ shopper }) => {
    // when
    const response = await shopper.webhooks.eventTypes();

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual([
      { name: 'order.created', description: 'An order was placed' },
      { name: 'order.paid', description: 'An order was paid' },
      { name: 'order.cancelled', description: 'An order was cancelled' },
      { name: 'shipment.shipped', description: 'An order was shipped' },
      { name: 'shipment.delivered', description: 'An order was delivered' },
      { name: 'refund.booked', description: 'A refund was booked for an order' },
      { name: 'payment.failed', description: 'A payment attempt failed' },
      { name: 'order.reservation-expired', description: 'The stock reservation of an unpaid order expired' },
      { name: 'webhook.ping', description: 'Sent by POST /api/v1/webhooks/{id}/test' },
    ]);
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new WebhooksClient(request).eventTypes();

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});
