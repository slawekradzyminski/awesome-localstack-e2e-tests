import { test, expect } from '@fixtures';
import { userPath, ValidationClient } from '@api/validation.client';
import type { ValidationErrors } from '@models/validation';

test.describe('PUT /api/v1/users/{username} - validation and access', { tag: ['@accounts'] }, () => {
  test('overlong names report the maximum length - 400', async ({ shopper, request }) => {
    // given
    const client = new ValidationClient(request, shopper.token);

    // when
    const response = await client.put(userPath(shopper.username),
      { email: shopper.user.email, firstName: 'x'.repeat(256), lastName: 'y'.repeat(256) });

    // then
    await expect(response, 'Profile edit with 256-character names').toHaveStatus(400);
    expect(await response.json() as ValidationErrors).toEqual({
      firstName: 'Maximum firstName length: 255 characters',
      lastName: 'Maximum lastName length: 255 characters',
    });
  });

  test('whitespace-only and invisible names are rejected - 400', async ({ shopper, request }) => {
    // given
    const client = new ValidationClient(request, shopper.token);

    // when
    const response = await client.put(userPath(shopper.username),
      { email: shopper.user.email, firstName: '    ', lastName: '​​​​' });

    // then
    await expect(response, 'Profile edit with blank names').toHaveStatus(400);
    expect(await response.json() as ValidationErrors).toEqual({
      firstName: 'firstName must not be blank',
      lastName: 'lastName must not be blank',
    });
  });

  const emailVariants: [string, (email: string) => string][] = [
    ['same case', (email) => email],
    ['upper case', (email) => email.toUpperCase()],
  ];
  for (const [variant, toVariant] of emailVariants) {
    test(`another user's email in ${variant} is already in use - 400`, async ({ shopper, otherShopper, request }) => {
      // given
      const email = toVariant(otherShopper.user.email);
      const client = new ValidationClient(request, shopper.token);

      // when
      const response = await client.put(userPath(shopper.username), { email, firstName: 'Changed', lastName: 'Changed' });

      // then
      await expect(response, 'Profile edit with a taken email').toHaveStatus(400);
      expect(await response.json()).toEqual({ message: 'Email is already in use' });
      const me = await client.get('/api/v1/users/me');
      expect((await me.json()).email).toBe(shopper.user.email);
    });
  }

  test('a client cannot tell a missing username from another user - 403', async ({ shopper, otherShopper, request }) => {
    // given
    const client = new ValidationClient(request, shopper.token);
    const body = { email: 'probe@example.com', firstName: 'Probe', lastName: 'Probe' };

    // when
    const missing = await client.put(userPath(`missing-${otherShopper.username}`), body);
    const existing = await client.put(userPath(otherShopper.username), body);

    // then
    await expect(missing, 'Edit a missing user').toHaveStatus(403);
    await expect(existing, 'Edit another user').toHaveStatus(403);
    expect(await missing.json()).toEqual({ message: 'Access denied' });
    expect(await existing.json()).toEqual({ message: 'Access denied' });
  });
});
