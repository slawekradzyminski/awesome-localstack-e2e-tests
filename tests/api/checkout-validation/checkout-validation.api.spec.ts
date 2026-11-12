import { test, expect } from '@fixtures';
import { ValidationClient } from '@api/validation.client';
import { addresses } from '@support/addresses';
import type { ValidationErrors } from '@models/validation';

const TOO_LONG = 'x'.repeat(256);

test.describe('cart and checkout - field types and limits', { tag: ['@catalog'] }, () => {
  test('overlong address fields are field errors and the cart stays - 400', async ({ shopper, request }) => {
    // given
    await shopper.fillCart();
    const client = new ValidationClient(request, shopper.token);

    // when
    const response = await client.post('/api/v1/orders',
      { ...addresses.poland, street: TOO_LONG, city: TOO_LONG, state: TOO_LONG, country: TOO_LONG });

    // then
    await expect(response, 'Checkout with 256-character address fields').toHaveStatus(400);
    expect(await response.json() as ValidationErrors).toEqual({
      street: 'Street must be at most 255 characters',
      city: 'City must be at most 255 characters',
      state: 'State must be at most 255 characters',
      country: 'Country must be at most 255 characters',
    });
    const cart = await (await shopper.cart.getCart()).json();
    expect(cart.items).toHaveLength(1);
  });

  for (const quantity of [1.5, '10']) {
    test(`cart quantity ${JSON.stringify(quantity)} is not coerced to an integer - 400`, async ({ api, shopper, request }) => {
      // given
      const product = await api.createProduct();
      const client = new ValidationClient(request, shopper.token);

      // when
      const response = await client.post('/api/v1/cart/items', { productId: product.id, quantity });

      // then
      await expect(response, 'Add to cart with a wrongly typed quantity').toHaveStatus(400);
      expect(await response.json() as ValidationErrors).toEqual({ quantity: 'Must be a whole number' });
      const cart = await (await shopper.cart.getCart()).json();
      expect(cart.items).toHaveLength(0);
    });
  }

  test('an unknown order status body lists the allowed values - 400', async ({ api, shopper, request }) => {
    // given
    const { order } = await shopper.placeOrder(10);
    const client = new ValidationClient(request, await api.getAdminToken());

    // when
    const response = await client.putRaw(`/api/v1/orders/${order.id}/status`, '"NOT_A_STATUS"');

    // then
    await expect(response, 'Set an unknown order status').toHaveStatus(400);
    const body = await response.json() as ValidationErrors;
    expect(body.error).toMatch(/^Request body must be one of: PENDING, /);
    expect(body.error).not.toContain('com.awesome');
  });

  test('an unknown order status filter keeps the error key and names the value - 400', async ({ shopper, request }) => {
    // when
    const response = await new ValidationClient(request, shopper.token).get('/api/v1/orders?status=NOT_A_STATUS');

    // then
    await expect(response, 'Filter orders by an unknown status').toHaveStatus(400);
    const body = await response.json() as ValidationErrors;
    expect(body.error).toContain("Unknown status 'NOT_A_STATUS'");
    expect(body.error).not.toContain('com.awesome');
  });
});
