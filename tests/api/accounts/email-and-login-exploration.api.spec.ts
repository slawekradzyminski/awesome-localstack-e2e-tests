import { test, expect } from '@fixtures';
import { ExplorationFunctionalClient } from '@api/exploration-functional.client';

interface OpenApiSchema {
  required?: string[];
  properties: Record<string, { example?: unknown }>;
}

// X-10: a missing or blank recipient is a 400 field error (was 409 'Operation conflicts with existing data').
test.describe('POST /api/v1/email - recipient', { tag: ['@accounts'] }, () => {
  const recipients: [string, Record<string, string>][] = [
    ['missing', {}],
    ['blank', { to: '   ' }],
  ];
  for (const [name, recipient] of recipients) {
    test(`rejects a ${name} recipient with a field error - 400`, async ({ api, shopper }) => {
      // given
      const client = new ExplorationFunctionalClient(api.request, shopper.token);

      // when
      const response = await client.sendEmail({ ...recipient, subject: 'Subject', message: 'Message body' });

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual({ to: 'Recipient is required' });
    });
  }

  test('keeps the format message for an invalid address - 400', async ({ api, shopper }) => {
    // given
    const client = new ExplorationFunctionalClient(api.request, shopper.token);

    // when
    const response = await client.sendEmail({ to: 'invalid-email', subject: 'Subject', message: 'Message body' });

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ to: 'Invalid email format' });
  });
});

// X-24: the documented schema matches the rules, and the login example signs in on a seeded stack.
test.describe('GET /v3/api-docs - recipient and login example', { tag: ['@accounts'] }, () => {
  test('documents the recipient as required and a working sign-in example - 200', async ({ api }) => {
    // given
    const client = new ExplorationFunctionalClient(api.request);
    const docs = await client.apiDocs();
    await expect(docs, 'Read the OpenAPI document').toHaveStatus(200);
    const schemas = ((await docs.json()) as { components: { schemas: Record<string, OpenApiSchema> } }).components.schemas;
    const login = schemas.LoginDto.properties;

    // when
    const signIn = await client.signIn({ username: login.username.example, password: login.password.example });

    // then
    expect(schemas.EmailDto.required).toContain('to');
    await expect(signIn).toHaveStatus(200);
  });
});
