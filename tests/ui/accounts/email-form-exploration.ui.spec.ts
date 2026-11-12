import { test, expect } from '@fixtures';
import { EmailPage } from '@pages/account/email.page';

// X-33: after 'Email queued for delivery' every field kept its value and Send stayed enabled.
test.describe('Send Email form', { tag: ['@accounts'] }, () => {
  test('the form is empty again after the email is queued, and the client sends no template (X-33)', async ({ shopperPage, shopper }) => {
    // given
    const email = new EmailPage(shopperPage);
    await email.goto();
    const sent = shopperPage.waitForRequest((request) => request.url().endsWith('/api/v1/email') && request.method() === 'POST');

    // when
    await email.sendEmail({ to: shopper.user.email, subject: 'Exploration X-33', message: 'The form should be empty after this.' });

    // then
    await expect(shopperPage.getByTestId('toast-description')).toHaveText('Email queued for delivery');
    await expect(email.to).toHaveValue('');
    await expect(email.subject).toHaveValue('');
    await expect(email.message).toHaveValue('');
    // Clients may only send GENERIC emails (backend 3.19); the form leaves the template to the default.
    expect((await sent).postDataJSON()).toEqual({ to: shopper.user.email, subject: 'Exploration X-33', message: 'The form should be empty after this.' });
  });
});
