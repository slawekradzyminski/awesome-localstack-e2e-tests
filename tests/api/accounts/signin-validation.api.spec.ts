import { test, expect } from '@fixtures';
import { SIGNIN, ValidationClient } from '@api/validation.client';
import { generateUser } from '@support/generators/user.generator';
import type { ValidationErrors } from '@models/validation';

test.describe('POST /api/v1/users/signin - validation and identity', { tag: ['@accounts'] }, () => {
  for (const body of [{}, { username: null, password: null }, { username: '', password: '' }]) {
    test(`missing credentials ${JSON.stringify(body)} are field errors - 400`, async ({ request }) => {
      // when
      const response = await new ValidationClient(request).post(SIGNIN, body);

      // then
      await expect(response, 'Sign in without credentials').toHaveStatus(400);
      expect(await response.json() as ValidationErrors).toEqual({
        username: 'Username is required',
        password: 'Password is required',
      });
    });
  }

  test('overlong credentials report the maximum length - 400', async ({ request }) => {
    // when
    const response = await new ValidationClient(request).post(SIGNIN, { username: 'u'.repeat(256), password: 'p'.repeat(256) });

    // then
    await expect(response, 'Sign in with 256-character values').toHaveStatus(400);
    expect(await response.json() as ValidationErrors).toEqual({
      username: 'Maximum username length: 255 characters',
      password: 'Maximum password length: 255 characters',
    });
  });

  test('malformed JSON is a validation error without parser details - 400', async ({ request }) => {
    // when
    const response = await new ValidationClient(request).postRaw(SIGNIN, '{"username":');

    // then
    await expect(response, 'Sign in with malformed JSON').toHaveStatus(400);
    expect(await response.json()).toEqual({ error: 'Malformed JSON request body' });
  });

  test('a non-JSON content type is an ErrorDto - 415', async ({ request }) => {
    // when
    const response = await new ValidationClient(request).postRaw(SIGNIN, 'username=admin', 'text/plain');

    // then
    await expect(response, 'Sign in with text/plain').toHaveStatus(415);
    expect(await response.json()).toEqual({ message: 'Content type text/plain is not supported' });
  });

  test('a numeric password is not coerced to a string - 400', async ({ request }) => {
    // when
    const response = await new ValidationClient(request).post(SIGNIN, { username: 'someone', password: 12345678 });

    // then
    await expect(response, 'Sign in with a numeric password').toHaveStatus(400);
    expect(await response.json() as ValidationErrors).toEqual({ password: 'Must be a string' });
  });

  test('the username matches regardless of letter case and the stored one is returned - 200', async ({ api, request }) => {
    // given
    const user = { ...generateUser(), username: `Mixed-${generateUser().username}` };
    await expect(await api.registerUser(user), 'Signup').toHaveStatus(201);

    // when
    const response = await new ValidationClient(request).post(SIGNIN, { username: user.username.toLowerCase(), password: user.password });

    // then
    await expect(response, 'Sign in with a lower-case username').toHaveStatus(200);
    expect((await response.json()).username).toBe(user.username);
  });

  test('bytes after the 72nd do not match the truncated password - 422', async ({ api, request }) => {
    // given
    const user = { ...generateUser(), password: 'p'.repeat(72) };
    await expect(await api.registerUser(user), 'Signup with a 72-byte password').toHaveStatus(201);

    // when
    const response = await new ValidationClient(request).post(SIGNIN, { username: user.username, password: `${user.password}EXTRA` });

    // then
    await expect(response, 'Sign in with the password plus a suffix').toHaveStatus(422);
    expect(await response.json()).toEqual({ message: 'Invalid username/password supplied' });
  });
});
