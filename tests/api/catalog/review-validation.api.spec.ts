import { test, expect } from '@fixtures';
import { productPath, ValidationClient } from '@api/validation.client';
import type { ValidationErrors } from '@models/validation';

test.describe('POST /api/v1/products/{id}/reviews - validation messages', { tag: ['@catalog'] }, () => {
  test('a blank and overlong title and body always report the required messages - 400', async ({ api, shopper, request }) => {
    // given: 200 spaces / 2100 spaces break both the required and the maximum-length rule
    const product = await api.createProduct();
    const client = new ValidationClient(request, shopper.token);
    const review = { rating: 5, title: ' '.repeat(200), body: ' '.repeat(2100) };

    // when
    const responses = await Promise.all(Array.from({ length: 8 }, () => client.post(`${productPath(product.id)}/reviews`, review)));

    // then
    const bodies = await Promise.all(responses.map(async (response) => ({ status: response.status(), body: await response.json() as ValidationErrors })));
    expect(bodies).toEqual(Array.from({ length: 8 }, () => ({
      status: 400,
      body: { title: 'Title is required', body: 'Review text is required' },
    })));
  });
});
