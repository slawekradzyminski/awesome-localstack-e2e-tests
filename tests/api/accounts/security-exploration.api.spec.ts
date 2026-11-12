import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { AuthClient } from '@api/auth.client';
import { ProductsClient } from '@api/products.client';
import { generateProduct } from '@support/generators/product.generator';

interface TrafficEntry {
  path: string;
  requestBody: unknown;
}

// A traffic session id is 16-128 characters of [A-Za-z0-9_-].
const newSessionId = () => `pw${randomUUID().replaceAll('-', '')}`;

// Regressions for the 2026-11-07 exploration findings fixed in backend 3.19.0.
test.describe('traffic logs (X-03)', { tag: ['@accounts', '@security'] }, () => {
  test('a sign-in recorded in the caller\'s own traffic has its password masked', async ({ api, shopper }) => {
    // given
    const session = newSessionId();
    const login = await new AuthClient(api.request).login(
      { username: shopper.username, password: shopper.user.password },
      { headers: { 'X-Client-Session-Id': session } },
    );
    await expect(login, 'sign-in in a traffic session').toHaveStatus(200);
    const { token } = await login.json();
    const headers = { Authorization: `Bearer ${token}`, 'X-Client-Session-Id': session };

    // when
    let entries: TrafficEntry[] = [];
    await expect.poll(async () => {
      const response = await api.request.get('/api/v1/traffic/logs', { params: { pathContains: '/users/signin', size: 5 }, headers });
      entries = (await response.json()).content ?? [];
      return entries.length;
    }, { message: 'the sign-in is recorded in the session' }).toBeGreaterThan(0);

    // then
    const stored = JSON.stringify(entries[0].requestBody);
    expect(stored).not.toContain(shopper.user.password);
    expect(stored).toContain('***');
  });

  test('another user cannot read someone else\'s traffic session', async ({ api, shopper, otherShopper }) => {
    // given: the shopper signs in inside a traffic session
    const session = newSessionId();
    const login = await new AuthClient(api.request).login(
      { username: shopper.username, password: shopper.user.password },
      { headers: { 'X-Client-Session-Id': session } },
    );
    await expect(login).toHaveStatus(200);
    const owner = { Authorization: `Bearer ${(await login.json()).token}`, 'X-Client-Session-Id': session };
    await expect.poll(async () => (await (await api.request.get('/api/v1/traffic/logs', { headers: owner })).json()).content?.length ?? 0)
      .toBeGreaterThan(0);

    // when: a different user asks for that session
    const response = await api.request.get('/api/v1/traffic/logs', {
      headers: { Authorization: `Bearer ${otherShopper.token}`, 'X-Client-Session-Id': session },
    });

    // then
    expect(JSON.stringify(await response.json())).not.toContain(shopper.username);
  });
});

test.describe('products without an image (X-01)', { tag: ['@catalog', '@security'] }, () => {
  test('a product created without imageUrl is stored with an empty one - 201', async ({ api }) => {
    // given
    const product = { ...generateProduct() };
    delete product.imageUrl;
    const products = new ProductsClient(api.request, await api.getAdminToken());

    // when
    const response = await products.create(product);

    // then
    await expect(response).toHaveStatus(201);
    const created = await response.json();
    api.trackProduct(created);
    expect(created.imageUrl ?? '').toBe('');
    expect((await (await products.getById(created.id)).json()).imageUrl ?? '').toBe('');
  });
});
