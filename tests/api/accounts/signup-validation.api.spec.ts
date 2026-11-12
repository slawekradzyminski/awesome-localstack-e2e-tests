import { test, expect } from '@fixtures';
import { SIGNIN, SIGNUP, ValidationClient } from '@api/validation.client';
import { generateUser } from '@support/generators/user.generator';
import type { ValidationErrors } from '@models/validation';

const TOO_LONG = 'x'.repeat(256);
const USERNAME_CHARACTERS = 'Username may only contain letters, digits, dots, underscores and hyphens';

test.describe('POST /api/v1/users/signup - field validation', { tag: ['@accounts'] }, () => {
  test('overlong username and names report the maximum length - 400', async ({ request }) => {
    // given
    const user = { ...generateUser(), username: TOO_LONG, firstName: TOO_LONG, lastName: TOO_LONG };

    // when
    const response = await new ValidationClient(request).post(SIGNUP, user);

    // then
    await expect(response, 'Signup with 256-character values').toHaveStatus(400);
    expect(await response.json() as ValidationErrors).toEqual({
      username: 'Maximum username length: 255 characters',
      firstName: 'Maximum firstName length: 255 characters',
      lastName: 'Maximum lastName length: 255 characters',
    });
  });

  test('too short values keep the minimum length messages - 400', async ({ request }) => {
    // given
    const user = { username: 'abc', email: 'invalid-email', password: 'short', firstName: 'abc', lastName: 'abc' };

    // when
    const response = await new ValidationClient(request).post(SIGNUP, user);

    // then
    await expect(response, 'Signup with too short values').toHaveStatus(400);
    expect(await response.json() as ValidationErrors).toEqual({
      username: 'Minimum username length: 4 characters',
      email: 'Email should be valid',
      password: 'Minimum password length: 8 characters',
      firstName: 'Minimum firstName length: 4 characters',
      lastName: 'Minimum lastName length: 4 characters',
    });
  });

  for (const email of ['', '   ']) {
    test(`email ${JSON.stringify(email)} is required - 400`, async ({ api }) => {
      // given
      const user = { ...generateUser(), email };

      // when
      const response = await api.registerUser(user);

      // then
      await expect(response, 'Signup with a blank email').toHaveStatus(400);
      expect(await response.json() as ValidationErrors).toEqual({ email: 'Email is required' });
    });
  }

  test('whitespace-only and invisible values are required fields - 400', async ({ api }) => {
    // given
    const user = { ...generateUser(), password: ' '.repeat(8), firstName: '​'.repeat(4), lastName: ' '.repeat(4) };

    // when
    const response = await api.registerUser(user);

    // then
    await expect(response, 'Signup with blank values').toHaveStatus(400);
    expect(await response.json() as ValidationErrors).toEqual({
      password: 'Password is required',
      firstName: 'firstName is required',
      lastName: 'lastName is required',
    });
  });

  test('spaces between visible characters are allowed - 201', async ({ api }) => {
    // given
    const user = { ...generateUser(), password: 'correct horse battery staple', firstName: 'Anna Maria', lastName: 'van der Berg' };

    // when
    const response = await api.registerUser(user);

    // then
    await expect(response, 'Signup with inner spaces').toHaveStatus(201);
  });

  for (const username of ['name\n1234', 'with space', 'trailing ', 'tab\tname', 'someone@example.com', 'zażółć']) {
    test(`username ${JSON.stringify(username)} uses characters outside the allowed set - 400`, async ({ api }) => {
      // given
      const user = { ...generateUser(), username };

      // when
      const response = await api.registerUser(user);

      // then
      await expect(response, 'Signup with a non-canonical username').toHaveStatus(400);
      expect(await response.json() as ValidationErrors).toEqual({ username: USERNAME_CHARACTERS });
    });
  }

  test('a username that differs only in letter case is taken - 400', async ({ api }) => {
    // given
    const first = generateUser();
    await expect(await api.registerUser(first), 'First signup').toHaveStatus(201);
    const second = { ...generateUser(), username: first.username.toUpperCase() };

    // when
    const response = await api.registerUser(second);

    // then
    await expect(response, 'Signup with a case-variant username').toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Username is already in use' });
  });

  test('an email that differs only in letter case is taken - 400', async ({ api }) => {
    // given
    const first = generateUser();
    await expect(await api.registerUser(first), 'First signup').toHaveStatus(201);
    const second = { ...generateUser(), email: first.email.toUpperCase() };

    // when
    const response = await api.registerUser(second);

    // then
    await expect(response, 'Signup with a case-variant email').toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Email is already in use' });
  });

  test('the email is stored lower-case - 201', async ({ api, request }) => {
    // given
    const generated = generateUser();
    const user = { ...generated, email: generated.email.replace('api-', 'Mixed.Case-').toUpperCase() };

    // when
    const response = await api.registerUser(user);

    // then
    await expect(response, 'Signup with an upper-case email').toHaveStatus(201);
    const login = await new ValidationClient(request).post(SIGNIN, { username: user.username, password: user.password });
    await expect(login, 'Sign in').toHaveStatus(200);
    expect((await login.json()).email).toBe(user.email.toLowerCase());
  });

  for (const [label, password] of [['73 ASCII characters', 'p'.repeat(73)], ['37 two-byte characters (74 bytes)', 'ż'.repeat(37)]]) {
    test(`a password of ${label} exceeds 72 bytes - 400`, async ({ api }) => {
      // given
      const user = { ...generateUser(), password };

      // when
      const response = await api.registerUser(user);

      // then
      await expect(response, 'Signup with a long password').toHaveStatus(400);
      expect(await response.json() as ValidationErrors).toEqual({ password: 'Maximum password length: 72 bytes' });
    });
  }

  test('a password of exactly 72 bytes is accepted - 201', async ({ api }) => {
    // given
    const user = { ...generateUser(), password: 'ż'.repeat(36) };

    // when
    const response = await api.registerUser(user);

    // then
    await expect(response, 'Signup with a 72-byte password').toHaveStatus(201);
  });

  test('a boolean first name is not coerced to a string - 400', async ({ request }) => {
    // given
    const user = { ...generateUser(), firstName: true };

    // when
    const response = await new ValidationClient(request).post(SIGNUP, user);

    // then
    await expect(response, 'Signup with firstName true').toHaveStatus(400);
    expect(await response.json() as ValidationErrors).toEqual({ firstName: 'Must be a string' });
  });
});
