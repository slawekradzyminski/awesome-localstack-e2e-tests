import { test, expect } from '@fixtures';
import { NotificationsClient } from '@api/notifications.client';
import { ASYNC_TIMEOUT, POLL_INTERVALS } from '@config';
import type { NotificationEmailDto, NotificationEmailPageDto } from '@models/notification';

test.describe('My notifications', { tag: ['@notifications'] }, () => {
  test('a new customer has no notifications yet', async ({ notificationsPage }) => {
    // when
    await notificationsPage.goto();

    // then
    await expect(notificationsPage.empty).toBeVisible();
  });

  test('shows the payment-received email of a paid order', { tag: '@slow' }, async ({ shopper, notificationsPage }) => {
    // given
    const { order } = await shopper.placeOrder(55);
    await shopper.payAndWaitForPaid(order.id);
    const client = new NotificationsClient(shopper.api.request, shopper.token);
    let email: NotificationEmailDto | undefined;
    await expect.poll(async () => {
      email = ((await (await client.emails()).json()) as NotificationEmailPageDto).content.find(sent => sent.template === 'PAYMENT_RECEIVED');
      return email?.status;
    }, { message: 'payment-received email is sent', timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS }).toBe('SENT');

    // when
    await notificationsPage.goto();

    // then
    await expect(notificationsPage.template(email!.id)).toHaveText('Payment received');
    await expect(notificationsPage.subject(email!.id)).toHaveText(email!.subject);
    await expect(notificationsPage.meta(email!.id)).toContainText(`To ${email!.recipientMasked}`);
    await expect(notificationsPage.status(email!.id)).toHaveText('SENT');
  });
});
