import { test, expect } from '@fixtures';
import { InboxReceiver } from '@support/webhooks';
import type { WebhookDeliveryDto } from '@models/webhook';

test.describe('account webhooks /account/webhooks - deliveries', { tag: ['@webhooks'] }, () => {
  test('sends a test ping and lists it as delivered', async ({ shopper, webhooksPage }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    await webhooksPage.goto();
    const card = webhooksPage.subscription(receiver.subscription.id);
    await card.toggleDeliveries();
    await expect(card.deliveriesEmpty).toHaveText('No deliveries yet. Send a test to see one.');

    // when
    await card.sendTest();

    // then
    await expect(card.testStatus).toHaveText('DELIVERED');
    await expect(card.testResult).toContainText('HTTP 200');
    const [delivery]: WebhookDeliveryDto[] = await receiver.deliveries();
    expect(delivery).toMatchObject({ eventType: 'webhook.ping', status: 'DELIVERED' });
    await expect(card.testResult).toContainText(`Test ping ${delivery.id}`);
    await expect(card.deliveryRows).toHaveCount(1);
    await expect(card.deliveryStatus(delivery.id)).toHaveText('DELIVERED');
    await expect(card.deliveryCode(delivery.id)).toHaveText('200');
    await expect(card.delivery(delivery.id)).toContainText('webhook.ping');
  });

  test('shows payload and headers of a delivery and redelivers it with the same event id', async ({ shopper, webhooksPage }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    const { order } = await shopper.placeOrder(18);
    await receiver.waitFor('order.created', order.id);
    const [original] = await receiver.deliveries();
    await webhooksPage.goto();
    const card = webhooksPage.subscription(receiver.subscription.id);
    await card.toggleDeliveries();

    // when
    await card.openDelivery(original.id);

    // then
    const { drawer } = webhooksPage;
    await expect(drawer.dialog).toBeVisible();
    await expect(drawer.status).toHaveText('DELIVERED');
    await expect(drawer.code).toHaveText('200');
    await expect(drawer.attempts).toHaveText('1');
    await expect(drawer.eventId).toHaveText(original.eventId);
    await expect(drawer.header('X-Webhook-Id')).toHaveText(original.id);
    await expect(drawer.header('X-Webhook-Event')).toHaveText('order.created');
    await expect(drawer.payload).toHaveText(JSON.stringify(JSON.parse(original.payload), null, 2));
    await expect(drawer.response).toHaveText(JSON.stringify({ received: true }, null, 2));

    // when
    await drawer.redeliver();

    // then
    await expect(drawer.result).toHaveText(/^Redelivered as [0-9a-f-]{36}: DELIVERED \(HTTP 200\)\.$/);
    const [redelivery, logged] = await receiver.deliveries();
    expect(logged).toEqual(original);
    expect(redelivery).toMatchObject({ eventId: original.eventId, payload: original.payload, status: 'DELIVERED' });
    await expect(drawer.result).toHaveText(`Redelivered as ${redelivery.id}: DELIVERED (HTTP 200).`);
    const [latest] = await receiver.waitForCount(2);
    expect(latest.payload.id).toBe(original.eventId);

    // when
    await drawer.close();

    // then
    await expect(drawer.dialog).toBeHidden();
    await expect(card.deliveryRows).toHaveCount(2);
  });

  test('filters deliveries by status and shows the error of a failed one', async ({ shopper, webhooksPage }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    await expect(await shopper.webhooks.ping(receiver.subscription.id)).toHaveStatus(201);
    await shopper.webhooks.deleteInbox(receiver.inbox.token);
    const failed: WebhookDeliveryDto = await (await shopper.webhooks.ping(receiver.subscription.id)).json();
    await webhooksPage.goto();
    const card = webhooksPage.subscription(receiver.subscription.id);
    await expect(card.failures).toHaveText('1 consecutive failures');
    await card.toggleDeliveries();
    await expect(card.deliveryRows).toHaveCount(2);

    // when
    await card.filterDeliveries('FAILED');

    // then
    await expect(card.deliveryRows).toHaveCount(1);
    await expect(card.deliveryStatus(failed.id)).toHaveText('FAILED');
    await card.openDelivery(failed.id);
    await expect(webhooksPage.drawer.lastError).toHaveText('Webhook inbox not found');
    await expect(webhooksPage.drawer.response).toHaveText('No response body recorded.');
  });

  test('cannot redeliver through a paused subscription', async ({ shopper, webhooksPage }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    const delivery: WebhookDeliveryDto = await (await shopper.webhooks.ping(receiver.subscription.id)).json();
    await shopper.webhooks.update(receiver.subscription.id, { url: receiver.inbox.url, events: ['order.created'], active: false });
    await webhooksPage.goto();
    const card = webhooksPage.subscription(receiver.subscription.id);
    await card.toggleDeliveries();

    // when
    await card.openDelivery(delivery.id);

    // then
    await expect(webhooksPage.drawer.redeliverButton).toBeDisabled();
    await expect(webhooksPage.drawer.dialog).toContainText('Re-enable the subscription to redeliver events.');
  });
});
