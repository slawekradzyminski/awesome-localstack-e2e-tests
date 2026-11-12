import { test, expect } from '@fixtures';
import { InboxReceiver, createInbox } from '@support/webhooks';
import { parseSignature } from '@support/webhook-signature';

test.describe('account webhooks /account/webhooks - built-in inboxes', { tag: ['@webhooks'] }, () => {
  test('shows the signed requests an inbox received as they arrive', { tag: '@slow' }, async ({ shopper, webhooksPage }) => {
    // given
    const receiver = await InboxReceiver.subscribe(shopper, ['order.created']);
    await webhooksPage.goto();
    const inbox = webhooksPage.inboxes.inbox(receiver.inbox.token);
    await expect(inbox.url).toHaveText(receiver.inbox.url);
    await webhooksPage.inboxes.toggleRequests(receiver.inbox.token);
    await expect(inbox.requestsEmpty).toHaveText('Nothing received yet.');

    // when
    const { order } = await shopper.placeOrder(21);

    // then
    const received = await receiver.waitFor('order.created', order.id);
    await expect(inbox.requests).toHaveCount(1);
    const request = webhooksPage.inboxes.request(received.raw.id);
    await expect(request.event).toHaveText('order.created');
    const { t, v1 } = parseSignature(received.signature!);
    await expect(request.signature).toHaveText(`t=${t} v1=${v1}`);
    await expect(request.body).toHaveText(JSON.stringify(received.payload, null, 2));
  });

  test('counts inboxes and stops at three', async ({ shopper, webhooksPage }) => {
    // given
    await createInbox(shopper.webhooks);
    await createInbox(shopper.webhooks);
    await webhooksPage.goto();
    await expect(webhooksPage.inboxes.count).toHaveText('2 of 3 inboxes used');

    // when
    await webhooksPage.inboxes.createInbox();

    // then
    await expect(webhooksPage.inboxes.count).toHaveText('3 of 3 inboxes used');
    await expect(webhooksPage.inboxes.urls).toHaveCount(3);
    await expect(webhooksPage.inboxes.createButton).toBeDisabled();
    expect(await (await shopper.webhooks.inboxes()).json()).toHaveLength(3);
  });

  test('copies an inbox URL to the clipboard', async ({ shopperPage, context, shopper, webhooksPage }) => {
    // given
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const created = await createInbox(shopper.webhooks);
    await webhooksPage.goto();

    // when
    await webhooksPage.inboxes.copyUrl(created.token);

    // then
    await expect(webhooksPage.inboxes.inbox(created.token).copyButton).toHaveText('Copied');
    expect(await shopperPage.evaluate(() => navigator.clipboard.readText())).toBe(created.url);
  });

  test('deletes an inbox after confirmation', async ({ shopper, webhooksPage }) => {
    // given
    const created = await createInbox(shopper.webhooks);
    await webhooksPage.goto();
    await expect(webhooksPage.inboxes.count).toHaveText('1 of 3 inboxes used');

    // when
    await webhooksPage.inboxes.deleteInbox(created.token);

    // then
    await expect(webhooksPage.inboxes.inbox(created.token).root).toBeHidden();
    await expect(webhooksPage.inboxes.count).toHaveText('0 of 3 inboxes used');
    await expect(webhooksPage.inboxes.empty).toBeVisible();
    expect(await (await shopper.webhooks.inboxes()).json()).toEqual([]);
  });
});
