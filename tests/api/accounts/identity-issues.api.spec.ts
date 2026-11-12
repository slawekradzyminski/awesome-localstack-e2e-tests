import { test, expect } from '@fixtures';
import { IDENTITY_ISSUES, ValidationClient } from '@api/validation.client';
import type { UserIdentityIssueDto } from '@models/validation';

test.describe('GET /api/v1/admin/users/identity-issues', { tag: ['@accounts'] }, () => {
  test('administrators get the accounts to clean up - 200', async ({ api, request }) => {
    // given
    const client = new ValidationClient(request, await api.getAdminToken());

    // when
    const response = await client.get(IDENTITY_ISSUES);

    // then
    await expect(response, 'List identity issues as admin').toHaveStatus(200);
    const issues: UserIdentityIssueDto[] = await response.json();
    expect(Array.isArray(issues)).toBe(true);
    expect(issues.every((issue) => issue.issues.length > 0)).toBe(true);
  });

  test('customers are forbidden - 403', async ({ shopper, request }) => {
    // when
    const response = await new ValidationClient(request, shopper.token).get(IDENTITY_ISSUES);

    // then
    await expect(response, 'List identity issues as a customer').toHaveStatus(403);
    expect(await response.json()).toEqual({ message: 'Access denied' });
  });

  test('anonymous callers are unauthorized - 401', async ({ request }) => {
    // when
    const response = await new ValidationClient(request).get(IDENTITY_ISSUES);

    // then
    await expect(response, 'List identity issues anonymously').toHaveStatus(401);
  });
});
