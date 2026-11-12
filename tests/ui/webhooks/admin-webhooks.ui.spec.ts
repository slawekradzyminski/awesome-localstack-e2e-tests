import { test, expect } from '@fixtures';
import { AdminWebhooksPage } from '@pages/admin/admin-webhooks.page';
import { PUBLIC_URL, subscribe } from '@support/webhooks';

test.describe('admin webhooks /admin/webhooks', { tag: ['@webhooks'] }, () => {
  test('filters every user\'s subscriptions by username', async ({ shopper, otherShopper, adminWebhooksPage }) => {
    // given
    const active = await subscribe(shopper.webhooks, `${PUBLIC_URL}/a`, ['order.created'], 'Mine');
    const paused = await subscribe(shopper.webhooks, `${PUBLIC_URL}/b`, ['refund.booked']);
    await shopper.webhooks.update(paused.id, { url: paused.url, events: paused.events, active: false });
    const others = await subscribe(otherShopper.webhooks, `${PUBLIC_URL}/c`, ['order.created']);
    await adminWebhooksPage.goto();

    // when
    await adminWebhooksPage.filterBy(shopper.username);

    // then
    await expect(adminWebhooksPage.rows).toHaveCount(2);
    await expect(adminWebhooksPage.row(active.id).username).toHaveText(shopper.username);
    await expect(adminWebhooksPage.row(active.id).root).toContainText(`${PUBLIC_URL}/a`);
    await expect(adminWebhooksPage.row(active.id).root).toContainText('Mine');
    await expect(adminWebhooksPage.row(active.id).active).toHaveText('Active');
    await expect(adminWebhooksPage.row(paused.id).active).toHaveText('Disabled');
    await expect(adminWebhooksPage.row(others.id).root).toBeHidden();

    // when
    await adminWebhooksPage.clearFilter();

    // then
    await expect(adminWebhooksPage.username).toHaveValue('');
    await expect(adminWebhooksPage.clearButton).toBeHidden();
  });

  test('says when no subscription matches the filter', async ({ shopper, adminWebhooksPage }) => {
    // given
    await adminWebhooksPage.goto();

    // when
    await adminWebhooksPage.filterBy(shopper.username);

    // then
    await expect(adminWebhooksPage.empty).toHaveText('No webhooks match this filter.');
    await expect(adminWebhooksPage.rows).toHaveCount(0);
  });

  test('sends a customer who opens the page back to the home page', async ({ shopperPage }) => {
    // given
    const adminWebhooksPage = new AdminWebhooksPage(shopperPage);

    // when
    await adminWebhooksPage.goto();

    // then
    await expect(shopperPage).toHaveURL('/');
    await expect(adminWebhooksPage.root).toBeHidden();
  });
});
