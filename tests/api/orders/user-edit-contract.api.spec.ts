import { test, expect } from '@fixtures';
import { UserEditClient } from '@api/user-edit.client';
import type { UserResponseDto } from '@models/commerce-fixes';

// T-028: the user edit answers with UserResponseDto and the OpenAPI success bodies carry real media types.
test.describe('OpenAPI contract clean-up', { tag: ['@orders'] }, () => {
  test('PUT /api/v1/users/{username} answers with the user response fields only - 200', async ({ api, shopper }) => {
    // given
    const client = new UserEditClient(api.request, shopper.token);

    // when
    const response = await client.edit(shopper.username, { email: shopper.user.email, firstName: 'Edited' });

    // then
    await expect(response).toHaveStatus(200);
    const body: UserResponseDto = await response.json();
    expect(Object.keys(body).sort()).toEqual(['email', 'firstName', 'id', 'lastName', 'roles', 'username']);
    expect(body).toMatchObject({ username: shopper.username, firstName: 'Edited', roles: ['ROLE_CLIENT'] });
  });

  test('GET /v3/api-docs documents no */* response and no UserEntity schema - 200', async ({ api }) => {
    // given
    const client = new UserEditClient(api.request);

    // when
    const response = await client.apiDocs();

    // then
    await expect(response).toHaveStatus(200);
    const document = await response.text();
    expect(document).not.toContain('"*/*"');
    expect(document).not.toContain('#/components/schemas/UserEntity');
  });
});
