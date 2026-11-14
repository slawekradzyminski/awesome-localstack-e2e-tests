import { test, expect } from '@fixtures';
import { NotificationsClient } from '@api/notifications.client';
import { ASYNC_TIMEOUT, POLL_INTERVALS } from '@config';
import type { NotificationEmailDto, NotificationEmailPageDto, OutboxEmailDto } from '@models/notification';
import type { Shopper } from '@support/shopper';

// notification-service 1.0.0 sends the commerce emails: the backend records a notification.requested feed
// event (NOTIFICATIONS_DELIVERY=feed) and the service renders it. The lightweight profile uses the local-outbox
// transport, so a sent email is readable at /api/v1/local/notifications/outbox (administrators).
async function emailsOf(shopper: Shopper): Promise<NotificationEmailDto[]> {
  const response = await new NotificationsClient(shopper.api.request, shopper.token).emails();
  await expect(response, `Notification emails of ${shopper.username}`).toHaveStatus(200);
  return ((await response.json()) as NotificationEmailPageDto).content;
}

const masked = (email: string) => `${email[0]}***${email.slice(email.indexOf('@'))}`;

test.describe('GET /api/v1/notifications/emails', { tag: ['@notifications'] }, () => {
  test('a paid order\'s payment-received email is sent by the notification-service - 200', { tag: '@slow' }, async ({ shopper, api }) => {
    // given
    const { order } = await shopper.placeOrder(80);

    // when
    await shopper.payAndWaitForPaid(order.id);

    // then
    await expect.poll(async () => (await emailsOf(shopper)).map(email => `${email.template} ${email.status}`), {
      message: 'payment-received email is sent', timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS,
    }).toContain('PAYMENT_RECEIVED SENT');
    const email = (await emailsOf(shopper)).find(sent => sent.template === 'PAYMENT_RECEIVED')!;
    expect(email).toMatchObject({ recipientMasked: masked(shopper.user.email), attempts: 1, failureReason: null, sentAt: expect.any(String) });
    expect(email.subject).toContain(String(order.id));
    // and the local-outbox transport captured exactly that email for the customer
    const outbox = await new NotificationsClient(api.request, await api.getAdminToken()).outbox();
    await expect(outbox).toHaveStatus(200);
    const captured = ((await outbox.json()) as OutboxEmailDto[])
      .filter(sent => sent.payload.to === shopper.user.email && sent.payload.template === 'PAYMENT_RECEIVED');
    expect(captured).toEqual([expect.objectContaining({ destination: 'email', payload: expect.objectContaining({ subject: email.subject }) })]);
  });

  test('a new customer has no notifications - 200', async ({ shopper }) => {
    // when
    const emails = await emailsOf(shopper);

    // then
    expect(emails).toEqual([]);
  });

  test('an administrator reads another customer\'s notifications - 200', { tag: '@slow' }, async ({ shopper, api }) => {
    // given
    const { order } = await shopper.placeOrder(30);
    await shopper.payAndWaitForPaid(order.id);
    await expect.poll(async () => (await emailsOf(shopper)).length, { timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS })
      .toBeGreaterThan(0);

    // when
    const response = await new NotificationsClient(api.request, await api.getAdminToken()).emails({ username: shopper.username });

    // then
    await expect(response).toHaveStatus(200);
    expect(((await response.json()) as NotificationEmailPageDto).content).toEqual(await emailsOf(shopper));
  });

  test('a customer cannot read another customer\'s notifications - 403', async ({ shopper, otherShopper }) => {
    // when
    const response = await new NotificationsClient(shopper.api.request, shopper.token).emails({ username: otherShopper.username });

    // then
    await expect(response).toHaveStatus(403);
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new NotificationsClient(request).emails();

    // then
    await expect(response).toHaveStatus(401);
  });
});

test.describe('GET /api/v1/local/notifications/outbox', { tag: ['@notifications'] }, () => {
  test('is for administrators only - 403', async ({ shopper }) => {
    // when
    const response = await new NotificationsClient(shopper.api.request, shopper.token).outbox();

    // then
    await expect(response).toHaveStatus(403);
  });

  test('commerce emails are no longer captured by the backend\'s own local outbox', { tag: '@slow' }, async ({ shopper, api }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    await shopper.payAndWaitForPaid(order.id);
    await expect.poll(async () => (await emailsOf(shopper)).map(email => email.template), { timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS })
      .toContain('PAYMENT_RECEIVED');

    // when
    const response = await api.request.get('/api/v1/local/email/outbox', { headers: { Authorization: `Bearer ${await api.getAdminToken()}` } });

    // then
    await expect(response).toHaveStatus(200);
    const backendOutbox: { payload?: { to?: string } }[] = await response.json();
    expect(backendOutbox.filter(sent => sent.payload?.to === shopper.user.email)).toEqual([]);
  });
});
