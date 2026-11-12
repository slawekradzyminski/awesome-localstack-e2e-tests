import { test, expect } from '@fixtures';
import { createSearchProduct, deliverAndReview, names, searchProducts, searchToken } from '@support/search';
import type { ApiTestContext } from '@support/api-test-context';
import type { ProductDto } from '@models/product';

// Created in this order, so the last one is the newest.
async function createTrio(api: ApiTestContext, token: string): Promise<{ banana: ProductDto; apple: ProductDto; cherry: ProductDto }> {
  const banana = await createSearchProduct(api, { name: `banana ${token}`, category: `${token}-fruit`, price: 20 });
  const apple = await createSearchProduct(api, { name: `Apple ${token}`, category: `${token}-fruit`, price: 30 });
  const cherry = await createSearchProduct(api, { name: `cherry ${token}`, category: `${token}-fruit`, price: 10 });
  return { banana, apple, cherry };
}

test.describe('GET /api/v1/products/search - sorting', { tag: ['@search'] }, () => {
  test('sorts by price ascending - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const { banana, apple, cherry } = await createTrio(api, token);

    // when
    const result = await searchProducts(shopper.search, { q: token, sort: 'price_asc' });

    // then
    expect(names(result)).toEqual([cherry.name, banana.name, apple.name]);
  });

  test('sorts by price descending - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const { banana, apple, cherry } = await createTrio(api, token);

    // when
    const result = await searchProducts(shopper.search, { q: token, sort: 'price_desc' });

    // then
    expect(names(result)).toEqual([apple.name, banana.name, cherry.name]);
  });

  test('sorts by name ignoring case - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const { banana, apple, cherry } = await createTrio(api, token);

    // when
    const result = await searchProducts(shopper.search, { q: token, sort: 'name_asc' });

    // then
    expect(names(result)).toEqual([apple.name, banana.name, cherry.name]);
  });

  test('sorts newest first - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const { banana, apple, cherry } = await createTrio(api, token);

    // when
    const result = await searchProducts(shopper.search, { q: token, sort: 'newest' });

    // then
    expect(names(result)).toEqual([cherry.name, apple.name, banana.name]);
  });

  test('defaults to newest first without a text query - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const { banana, apple, cherry } = await createTrio(api, token);

    // when
    const result = await searchProducts(shopper.search, { category: [`${token}-fruit`] });

    // then
    expect(names(result)).toEqual([cherry.name, apple.name, banana.name]);
  });

  test('falls back to newest for relevance without a text query - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const { banana, apple, cherry } = await createTrio(api, token);

    // when
    const result = await searchProducts(shopper.search, { category: [`${token}-fruit`], sort: 'relevance' });

    // then
    expect(names(result)).toEqual([cherry.name, apple.name, banana.name]);
  });

  test('accepts sort values in any case - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const { banana, apple, cherry } = await createTrio(api, token);

    // when
    const result = await searchProducts(shopper.search, { q: token, sort: 'PRICE_ASC' });

    // then
    expect(names(result)).toEqual([cherry.name, banana.name, apple.name]);
  });

  test('sorts by average rating, then review count, with unrated products last - 200', async ({ api, shopper, warehouse }) => {
    // given
    const token = searchToken();
    const unrated = await createSearchProduct(api, { name: `Aaa unrated ${token}`, category: `${token}-rated`, stockQuantity: 5 });
    const low = await createSearchProduct(api, { name: `Bbb low ${token}`, category: `${token}-rated`, stockQuantity: 5 });
    const top = await createSearchProduct(api, { name: `Ccc top ${token}`, category: `${token}-rated`, stockQuantity: 5 });
    await deliverAndReview(shopper, warehouse, [{ product: low, rating: 2 }, { product: top, rating: 4 }]);

    // when
    const result = await searchProducts(shopper.search, { q: token, sort: 'rating_desc' });

    // then
    expect(result.content).toEqual([
      expect.objectContaining({ id: top.id, averageRating: 4, reviewCount: 1 }),
      expect.objectContaining({ id: low.id, averageRating: 2, reviewCount: 1 }),
      expect.objectContaining({ id: unrated.id, averageRating: null, reviewCount: 0 }),
    ]);
  });
});

test.describe('GET /api/v1/products/search - paging', { tag: ['@search'] }, () => {
  test('pages through the results with totals - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const created: ProductDto[] = [];
    for (let index = 1; index <= 5; index++) {
      created.push(await createSearchProduct(api, { name: `Item ${index} ${token}`, category: `${token}-paged`, price: index }));
    }

    // when
    const first = await searchProducts(shopper.search, { q: token, sort: 'price_asc', page: 0, size: 2 });
    const last = await searchProducts(shopper.search, { q: token, sort: 'price_asc', page: 2, size: 2 });

    // then
    expect(first).toMatchObject({ pageNumber: 0, pageSize: 2, totalElements: 5, totalPages: 3 });
    expect(names(first)).toEqual([created[0].name, created[1].name]);
    expect(last).toMatchObject({ pageNumber: 2, pageSize: 2, totalElements: 5, totalPages: 3 });
    expect(names(last)).toEqual([created[4].name]);
  });

  test('returns an empty page past the end with the real totals and facets - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    await createSearchProduct(api, { name: `Only ${token}`, category: `${token}-paged`, price: 7 });

    // when
    const result = await searchProducts(shopper.search, { q: token, page: 5, size: 10 });

    // then
    expect(result).toEqual({
      content: [],
      pageNumber: 5,
      pageSize: 10,
      totalElements: 1,
      totalPages: 1,
      facets: { categories: [{ value: `${token}-paged`, count: 1 }], priceRange: { min: 7, max: 7 }, inStockCount: 1 },
    });
  });

  test('accepts the maximum page size of 100 - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    await createSearchProduct(api, { name: `Only ${token}`, category: `${token}-paged` });

    // when
    const result = await searchProducts(shopper.search, { q: token, size: 100 });

    // then
    expect(result).toMatchObject({ pageNumber: 0, pageSize: 100, totalElements: 1, totalPages: 1 });
  });
});
