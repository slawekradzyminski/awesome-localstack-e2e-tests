import { test, expect } from '@fixtures';
import { AuthClient } from '@api/auth.client';
import { SecurityTwoClient } from '@api/security-2.client';

interface DirectoryUser {
  username: string;
  email: string;
}

const maskedEmail = (email: string) => {
  const canonical = email.toLowerCase();
  return `${canonical[0]}***${canonical.slice(canonical.lastIndexOf('@'))}`;
};

// Regressions for the 2026-11-07 exploration findings fixed in backend 3.20.0.
test.describe('token revocation (X-08)', { tag: ['@accounts', '@security'] }, () => {
  test('logout revokes the access and refresh tokens of every session of the user - 401', async ({ api, shopper }) => {
    // given: the shopper is signed in twice (two devices)
    const security = new SecurityTwoClient(api.request);
    const login = await new AuthClient(api.request).login({ username: shopper.username, password: shopper.user.password });
    await expect(login, 'second sign-in').toHaveStatus(200);
    const secondDevice = await login.json();

    // when
    await expect(await security.logout(shopper.token), 'logout').toHaveStatus(200);

    // then
    const firstMe = await security.me(shopper.token);
    await expect(firstMe, 'first device after logout').toHaveStatus(401);
    expect(await firstMe.json()).toEqual({ message: 'Invalid or expired token' });
    await expect(await security.me(secondDevice.token), 'second device after logout').toHaveStatus(401);
    await expect(await security.refresh(secondDevice.refreshToken), 'refresh after logout').toHaveStatus(401);
  });

  test('a password reset revokes the access tokens issued before it - 401', async ({ api, shopper }) => {
    // given: the lightweight stack returns the reset token in the forgot-password response
    const security = new SecurityTwoClient(api.request);
    const forgot = await security.forgotPassword(shopper.username);
    await expect(forgot, 'forgot password').toHaveStatus(202);
    const { token: resetToken } = await forgot.json();
    const newPassword = 'Reset-Password-123!';

    // when
    await expect(await security.resetPassword(resetToken, newPassword), 'reset password').toHaveStatus(200);

    // then
    await expect(await security.me(shopper.token), 'old access token').toHaveStatus(401);
    const fresh = await new AuthClient(api.request).login({ username: shopper.username, password: newPassword });
    await expect(fresh, 'sign-in with the new password').toHaveStatus(200);
    await expect(await security.me((await fresh.json()).token), 'new access token').toHaveStatus(200);
  });
});

test.describe('user directory (X-12)', { tag: ['@accounts', '@security'] }, () => {
  test('a client sees its own email and the other accounts masked - 200', async ({ api, shopper, otherShopper }) => {
    // given
    const security = new SecurityTwoClient(api.request);

    // when
    const list = await security.users(shopper.token);
    const other = await security.user(otherShopper.username, shopper.token);

    // then
    await expect(list, 'user directory').toHaveStatus(200);
    const users = (await list.json()) as DirectoryUser[];
    expect(users.find((user) => user.username === shopper.username)?.email).toBe(shopper.user.email.toLowerCase());
    expect(users.find((user) => user.username === otherShopper.username)?.email).toBe(maskedEmail(otherShopper.user.email));
    await expect(other, 'another account').toHaveStatus(200);
    expect((await other.json()).email).toBe(maskedEmail(otherShopper.user.email));
  });

  test('an administrator sees every email in full - 200', async ({ api, otherShopper }) => {
    // given
    const security = new SecurityTwoClient(api.request);

    // when
    const other = await security.user(otherShopper.username, await api.getAdminToken());

    // then
    await expect(other, 'another account as admin').toHaveStatus(200);
    expect((await other.json()).email).toBe(otherShopper.user.email.toLowerCase());
  });
});

test.describe('send email (X-05)', { tag: ['@accounts', '@security'] }, () => {
  test('a client cannot send a system template such as a password reset - 400', async ({ api, shopper }) => {
    // given
    const email = {
      to: 'victim@example.com',
      subject: 'Reset your password',
      message: 'Click the link',
      template: 'PASSWORD_RESET_REQUESTED',
      properties: { resetLink: 'http://evil.example/reset' },
    };

    // when
    const response = await new SecurityTwoClient(api.request).sendEmail(email, shopper.token);

    // then
    await expect(response, 'system template from a client').toHaveStatus(400);
    expect(await response.json()).toEqual({ template: 'Only GENERIC emails can be sent' });
  });

  test('a client can still send a GENERIC email with properties - 200', async ({ api, shopper }) => {
    // given
    const email = { to: 'recipient@example.com', subject: 'Hello', message: 'Hi', template: 'GENERIC', properties: { source: 'e2e' } };

    // when
    const response = await new SecurityTwoClient(api.request).sendEmail(email, shopper.token);

    // then
    await expect(response, 'generic email from a client').toHaveStatus(200);
  });
});

test.describe('authorization before validation (X-23)', { tag: ['@catalog', '@security'] }, () => {
  test('a client posting an invalid product gets 403, not the admin validation rules', async ({ api, shopper }) => {
    // when
    const response = await new SecurityTwoClient(api.request).createProduct({ name: 'QA' }, shopper.token);

    // then
    await expect(response, 'invalid product from a client').toHaveStatus(403);
    expect(await response.json()).toEqual({ message: 'Access denied' });
  });
});
