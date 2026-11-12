import { test, expect } from '@fixtures';
import { createSearchProduct, deliverAndReview, names, searchProducts, searchToken } from '@support/search';

test.describe('GET /api/v1/products/search - text query', { tag: ['@search'] }, () => {
  test('matches the name case-insensitively - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const lamp = await createSearchProduct(api, { name: `Desk Lamp ${token}`, category: `${token}-home`, price: 25 });
    await createSearchProduct(api, { name: `Desk Chair ${token}`, category: `${token}-home` });

    // when
    const response = await shopper.search.search({ q: `LAMP ${token.toUpperCase()}` });

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({
      content: [{
        id: lamp.id,
        name: lamp.name,
        description: lamp.description,
        price: 25,
        stockQuantity: lamp.stockQuantity,
        category: lamp.category,
        // backend 3.19.0 stores a missing image as an empty string (X-01)
        imageUrl: '',
        createdAt: lamp.createdAt,
        averageRating: null,
        reviewCount: 0,
      }],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 1,
      totalPages: 1,
    });
  });

  test('matches the description and the category as well as the name - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const byName = await createSearchProduct(api, { name: `Kettle ${token}`, category: 'Kitchen' });
    const byDescription = await createSearchProduct(api, { name: `Toaster ${searchToken()}`, category: 'Kitchen', description: `Pairs with ${token} breakfast sets` });
    const byCategory = await createSearchProduct(api, { name: `Blender ${searchToken()}`, category: `Appliances ${token}` });

    // when
    const result = await searchProducts(shopper.search, { q: token, sort: 'name_asc' });

    // then
    expect(names(result)).toEqual([byCategory.name, byName.name, byDescription.name]);
  });

  test('ranks name matches above category matches above description matches by default - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const byDescription = await createSearchProduct(api, { name: `Aaa ${searchToken()}`, category: 'Misc', description: `About ${token}` });
    const byCategory = await createSearchProduct(api, { name: `Bbb ${searchToken()}`, category: `Cat ${token}` });
    const byName = await createSearchProduct(api, { name: `Ccc ${token}`, category: 'Misc' });

    // when
    const result = await searchProducts(shopper.search, { q: token });

    // then
    expect(names(result)).toEqual([byName.name, byCategory.name, byDescription.name]);
  });

  test('treats % and _ in the query as literal characters - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const literal = await createSearchProduct(api, { name: `Sale ${token}%_off`, category: `${token}-sale` });
    await createSearchProduct(api, { name: `Sale ${token}xxoff`, category: `${token}-sale` });

    // when
    const result = await searchProducts(shopper.search, { q: `${token}%_` });

    // then
    expect(names(result)).toEqual([literal.name]);
  });

  test('returns an empty page when nothing matches - 200', async ({ shopper }) => {
    // when
    const response = await shopper.search.search({ q: searchToken() });

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({
      content: [],
      pageNumber: 0,
      pageSize: 20,
      totalElements: 0,
      totalPages: 0,
      facets: { categories: [], priceRange: { min: null, max: null }, inStockCount: 0 },
    });
  });
});

test.describe('GET /api/v1/products/search - filters', { tag: ['@search'] }, () => {
  test('filters by one category case-insensitively - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const garden = await createSearchProduct(api, { name: `Rake ${token}`, category: `Garden-${token}` });
    await createSearchProduct(api, { name: `Hammer ${token}`, category: `Tools-${token}` });

    // when
    const result = await searchProducts(shopper.search, { category: [`GARDEN-${token.toUpperCase()}`] });

    // then
    expect(names(result)).toEqual([garden.name]);
    expect(result.totalElements).toBe(1);
  });

  test('combines repeated category parameters - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const garden = await createSearchProduct(api, { name: `Rake ${token}`, category: `Garden-${token}` });
    const tools = await createSearchProduct(api, { name: `Hammer ${token}`, category: `Tools-${token}` });
    await createSearchProduct(api, { name: `Paint ${token}`, category: `Decor-${token}` });

    // when
    const result = await searchProducts(shopper.search, { category: [`Garden-${token}`, `Tools-${token}`], sort: 'name_asc' });

    // then
    expect(names(result)).toEqual([tools.name, garden.name]);
  });

  test('accepts comma-separated categories - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const garden = await createSearchProduct(api, { name: `Rake ${token}`, category: `Garden-${token}` });
    const tools = await createSearchProduct(api, { name: `Hammer ${token}`, category: `Tools-${token}` });
    await createSearchProduct(api, { name: `Paint ${token}`, category: `Decor-${token}` });

    // when
    const result = await searchProducts(shopper.search, { category: `Garden-${token}, Tools-${token}`, sort: 'name_asc' });

    // then
    expect(names(result)).toEqual([tools.name, garden.name]);
  });

  test('includes both price bounds - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    for (const price of [9.99, 10, 15, 20, 20.01]) {
      await createSearchProduct(api, { name: `Item ${price} ${token}`, category: `${token}-priced`, price });
    }

    // when
    const result = await searchProducts(shopper.search, { q: token, minPrice: 10, maxPrice: 20, sort: 'price_asc' });

    // then
    expect(result.content.map((item) => item.price)).toEqual([10, 15, 20]);
  });

  test('accepts equal minimum and maximum prices - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const exact = await createSearchProduct(api, { name: `Exact ${token}`, category: `${token}-priced`, price: 12.5 });
    await createSearchProduct(api, { name: `Other ${token}`, category: `${token}-priced`, price: 12.51 });

    // when
    const result = await searchProducts(shopper.search, { q: token, minPrice: 12.5, maxPrice: 12.5 });

    // then
    expect(names(result)).toEqual([exact.name]);
  });

  test('returns only products with stock when inStock is true - 200', async ({ api, shopper }) => {
    // given
    const token = searchToken();
    const available = await createSearchProduct(api, { name: `Available ${token}`, category: `${token}-stock`, stockQuantity: 1 });
    const soldOut = await createSearchProduct(api, { name: `Sold out ${token}`, category: `${token}-stock`, stockQuantity: 0 });

    // when
    const inStockOnly = await searchProducts(shopper.search, { q: token, inStock: true });
    const unfiltered = await searchProducts(shopper.search, { q: token, inStock: false, sort: 'name_asc' });

    // then
    expect(names(inStockOnly)).toEqual([available.name]);
    expect(names(unfiltered)).toEqual([available.name, soldOut.name]);
  });

  test('filters by the average of approved ratings and leaves out unrated products - 200', async ({ api, shopper, warehouse }) => {
    // given
    const token = searchToken();
    const loved = await createSearchProduct(api, { name: `Loved ${token}`, category: `${token}-rated`, stockQuantity: 5 });
    const average = await createSearchProduct(api, { name: `Average ${token}`, category: `${token}-rated`, stockQuantity: 5 });
    await createSearchProduct(api, { name: `Unrated ${token}`, category: `${token}-rated`, stockQuantity: 5 });
    await deliverAndReview(shopper, warehouse, [{ product: loved, rating: 5 }, { product: average, rating: 3 }]);

    // when
    const atLeastFour = await searchProducts(shopper.search, { q: token, minRating: 4 });
    const atLeastThree = await searchProducts(shopper.search, { q: token, minRating: 3, sort: 'name_asc' });

    // then
    expect(atLeastFour.content).toEqual([expect.objectContaining({ id: loved.id, averageRating: 5, reviewCount: 1 })]);
    expect(atLeastThree.content).toEqual([
      expect.objectContaining({ id: average.id, averageRating: 3, reviewCount: 1 }),
      expect.objectContaining({ id: loved.id, averageRating: 5, reviewCount: 1 }),
    ]);
  });
});
