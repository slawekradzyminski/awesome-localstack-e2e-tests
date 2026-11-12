import { test, expect } from '@fixtures';
import { createSearchProduct, names, searchProducts, searchToken } from '@support/search';
import type { ApiTestContext } from '@support/api-test-context';

// Two categories of the same token: three garden products (one sold out) and one tool.
async function createShop(api: ApiTestContext, token: string) {
  const garden = `Garden ${token}`;
  const tools = `Tools ${token}`;
  const rake = await createSearchProduct(api, { name: `Rake ${token}`, category: garden, price: 15, stockQuantity: 3 });
  const hose = await createSearchProduct(api, { name: `Hose ${token}`, category: garden, price: 40, stockQuantity: 0 });
  const seeds = await createSearchProduct(api, { name: `Seeds ${token}`, category: garden, price: 2.5, stockQuantity: 9 });
  const hammer = await createSearchProduct(api, { name: `Hammer ${token}`, category: tools, price: 99.99, stockQuantity: 4 });
  return { garden, tools, rake, hose, seeds, hammer };
}

test.describe('GET /api/v1/products/search - facets', { tag: ['@search'] }, () => {
  test('counts categories, the price range and in-stock products of the result - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const { garden, tools } = await createShop(api, token);

    // when
    const result = await searchProducts(shopper.search, { q: token });

    // then
    expect(result.totalElements).toBe(4);
    expect(result.facets).toEqual({
      categories: [{ value: garden, count: 3 }, { value: tools, count: 1 }],
      priceRange: { min: 2.5, max: 99.99 },
      inStockCount: 3,
    });
  });

  test('ignores the category filter so the other categories stay selectable - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const { garden, tools, hammer } = await createShop(api, token);

    // when
    const result = await searchProducts(shopper.search, { q: token, category: [tools] });

    // then
    expect(names(result)).toEqual([hammer.name]);
    expect(result.totalElements).toBe(1);
    expect(result.facets).toEqual({
      categories: [{ value: garden, count: 3 }, { value: tools, count: 1 }],
      priceRange: { min: 2.5, max: 99.99 },
      inStockCount: 3,
    });
  });

  test('narrows every facet by the price and stock filters - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const { garden, rake } = await createShop(api, token);

    // when
    const result = await searchProducts(shopper.search, { q: token, minPrice: 10, maxPrice: 50, inStock: true });

    // then
    expect(names(result)).toEqual([rake.name]);
    expect(result.facets).toEqual({
      categories: [{ value: garden, count: 1 }],
      priceRange: { min: 15, max: 15 },
      inStockCount: 1,
    });
  });

  test('orders category facets by count, then by name - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    for (const category of ['b', 'a', 'c', 'c']) {
      await createSearchProduct(api, { name: `Item ${category} ${token}`, category: `${category}-${token}` });
    }

    // when
    const result = await searchProducts(shopper.search, { q: token });

    // then
    expect(result.facets.categories).toEqual([
      { value: `c-${token}`, count: 2 },
      { value: `a-${token}`, count: 1 },
      { value: `b-${token}`, count: 1 },
    ]);
  });
});
