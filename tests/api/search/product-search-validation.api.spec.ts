import { test, expect } from '@fixtures';
import { SearchClient } from '@api/search.client';
import { ProductsClient } from '@api/products.client';
import { createSearchProduct, searchToken } from '@support/search';
import type { Query } from '@api/api-client';

const SORT_VALUES = 'relevance, newest, price_asc, price_desc, name_asc, rating_desc';

test.describe('GET /api/v1/products/search - validation', { tag: ['@search'] }, () => {
  const invalidQueries: { title: string; query: Query; errors: Record<string, string> }[] = [
    { title: 'an unknown sort value', query: { sort: 'cheapest' }, errors: { sort: `must be one of ${SORT_VALUES}` } },
    { title: 'a minimum price above the maximum', query: { minPrice: 20, maxPrice: 10 }, errors: { minPrice: 'must not be greater than maxPrice' } },
    { title: 'negative prices', query: { minPrice: -1, maxPrice: -0.01 }, errors: { minPrice: 'must be zero or greater', maxPrice: 'must be zero or greater' } },
    { title: 'a page size above 100', query: { size: 101 }, errors: { size: 'must be between 1 and 100' } },
    { title: 'a page size of 0', query: { size: 0 }, errors: { size: 'must be between 1 and 100' } },
    { title: 'a negative page', query: { page: -1 }, errors: { page: 'must be zero or greater' } },
    { title: 'a minimum rating below 1', query: { minRating: 0.5 }, errors: { minRating: 'must be between 1 and 5' } },
    { title: 'a minimum rating above 5', query: { minRating: 5.5 }, errors: { minRating: 'must be between 1 and 5' } },
    { title: 'a query over 100 characters', query: { q: 'q'.repeat(101) }, errors: { q: 'must be at most 100 characters' } },
    { title: 'more than 20 categories', query: { category: Array.from({ length: 21 }, (_, index) => `c${index}`) }, errors: { category: 'must list at most 20 categories' } },
    {
      title: 'values of the wrong type, all at once',
      query: { minPrice: 'cheap', maxPrice: 'dear', minRating: 'good', inStock: 'yes', page: 'first', size: 'big' },
      errors: {
        minPrice: 'must be a number',
        maxPrice: 'must be a number',
        minRating: 'must be a number',
        inStock: 'must be true or false',
        page: 'must be an integer',
        size: 'must be an integer',
      },
    },
  ];

  for (const { title, query, errors } of invalidQueries) {
    test(`rejects ${title} - 400`, async ({ shopper }) => {
      // when
      const response = await shopper.search.search(query);

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual(errors);
    });
  }

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new SearchClient(request).search({ q: 'lamp' });

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});

test.describe('GET /api/v1/products', { tag: ['@search'] }, () => {
  test('still returns a plain array of products next to the search endpoint - 200', async ({ api, shopper }) => {
    // given
    const product = await createSearchProduct(api, { name: `Plain ${searchToken()}`, category: 'Plain' });

    // when
    const response = await new ProductsClient(shopper.api.request, shopper.token).getAll();

    // then
    await expect(response).toHaveStatus(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toContainEqual(expect.objectContaining({ id: product.id, name: product.name, price: product.price }));
    expect(body[0]).not.toHaveProperty('facets');
    expect(body[0]).not.toHaveProperty('averageRating');
  });
});
