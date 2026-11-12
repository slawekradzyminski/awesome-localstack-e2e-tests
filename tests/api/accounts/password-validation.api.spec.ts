import { test, expect } from '@fixtures';
import { PASSWORD_FORGOT, PASSWORD_RESET, ValidationClient } from '@api/validation.client';
import { generateUser } from '@support/generators/user.generator';
import type { ValidationErrors } from '@models/validation';

test.describe('password forgot and reset - identity and byte limit', { tag: ['@accounts'] }, () => {
  test('another user\'s email cannot become a username and reset for that email works - 202', async ({ shopper, api, request }) => {
    // given: before the fix this signup succeeded and the forgot request below failed with 500
    const impostor = { ...generateUser(), username: shopper.user.email };
    const signup = await api.registerUser(impostor);

    // when
    const response = await new ValidationClient(request).post(PASSWORD_FORGOT, { identifier: shopper.user.email.toUpperCase() });

    // then
    await expect(signup, 'Signup with another user\'s email as username').toHaveStatus(400);
    await expect(response, 'Forgot password by email').toHaveStatus(202);
    expect((await response.json()).message).toBe('If the account exists, password reset instructions have been sent.');
  });

  test('a new password over 72 bytes is rejected - 400', async ({ request }) => {
    // given
    const password = 'q'.repeat(100);

    // when
    const response = await new ValidationClient(request).post(PASSWORD_RESET,
      { token: 'any-token', newPassword: password, confirmPassword: password });

    // then
    await expect(response, 'Reset with a 100-byte password').toHaveStatus(400);
    expect(await response.json() as ValidationErrors).toEqual({ newPassword: 'Maximum password length: 72 bytes' });
  });
});
