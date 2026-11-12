import { test, expect } from '@fixtures';
import { createSearchProduct, deliverAndReview, searchProducts, searchToken } from '@support/search';

test.describe('product search page', { tag: ['@search'] }, () => {
  test('finds products by text and writes the query to the URL', async ({ api, productSearchPage }) => {
    // given
    const token = searchToken();
    const alpha = await createSearchProduct(api, { name: `Alpha ${token}`, category: 'Lighting' });
    const beta = await createSearchProduct(api, { name: `Beta ${token}`, category: 'Lighting' });
    await productSearchPage.goto();

    // when
    await productSearchPage.search(token.toUpperCase());

    // then
    await expect(productSearchPage.productNames).toHaveText([alpha.name, beta.name]);
    await expect(productSearchPage.summary).toHaveText('Showing 1–2 of 2');
    expect(productSearchPage.currentQuery().get('q')).toBe(token.toUpperCase());
  });

  test('narrows the results with category facets and keeps the counts of the alternatives', async ({ api, productSearchPage }) => {
    // given
    const token = searchToken();
    const garden = `Garden ${token}`;
    const tools = `Tools ${token}`;
    const rake = await createSearchProduct(api, { name: `Rake ${token}`, category: garden });
    const hose = await createSearchProduct(api, { name: `Hose ${token}`, category: garden });
    const hammer = await createSearchProduct(api, { name: `Hammer ${token}`, category: tools });
    await productSearchPage.goto({ q: token, sort: 'name-asc' });
    await expect(productSearchPage.categoryCount(garden)).toHaveText('2');
    await expect(productSearchPage.categoryCount(tools)).toHaveText('1');

    // when
    await productSearchPage.selectCategory(garden);

    // then
    await expect(productSearchPage.productNames).toHaveText([hose.name, rake.name]);
    await expect(productSearchPage.title).toHaveText(`${garden} Products`);
    await expect(productSearchPage.categoryCount(tools)).toHaveText('1');
    expect(productSearchPage.currentQuery().getAll('category')).toEqual([garden]);

    // when
    await productSearchPage.selectCategory(tools);

    // then
    await expect(productSearchPage.productNames).toHaveText([hammer.name, hose.name, rake.name]);
    await expect(productSearchPage.title).toHaveText('Products in 2 categories');
    expect(productSearchPage.currentQuery().getAll('category')).toEqual([garden, tools]);
  });

  test('filters by an inclusive price range', async ({ api, productSearchPage }) => {
    // given
    const token = searchToken();
    for (const price of [5, 10, 20, 25]) {
      await createSearchProduct(api, { name: `Item ${price} ${token}`, category: 'Priced', price });
    }
    await productSearchPage.goto({ q: token, sort: 'price-asc' });
    await expect(productSearchPage.productPrices).toHaveText(['$5.00', '$10.00', '$20.00', '$25.00']);

    // when
    await productSearchPage.setPriceRange('10', '20');

    // then
    await expect(productSearchPage.productPrices).toHaveText(['$10.00', '$20.00']);
    expect(productSearchPage.currentQuery().get('minPrice')).toBe('10');
    expect(productSearchPage.currentQuery().get('maxPrice')).toBe('20');
  });

  test('shows the backend validation message for a minimum price above the maximum', async ({ api, productSearchPage }) => {
    // given
    const token = searchToken();
    await createSearchProduct(api, { name: `Item ${token}`, category: 'Priced', price: 15 });
    await productSearchPage.goto({ q: token });
    await expect(productSearchPage.productNames).toHaveCount(1);

    // when
    await productSearchPage.setPriceRange('30', '10');

    // then
    await expect(productSearchPage.minPriceError).toHaveText('Min: must not be greater than maxPrice');
    await expect(productSearchPage.minPrice).toHaveAttribute('aria-invalid', 'true');
    await expect(productSearchPage.validationError('minPrice')).toHaveText('minPrice: must not be greater than maxPrice');
    await expect(productSearchPage.productNames).toHaveCount(0);
  });

  test('reports a malformed filter from the URL inline', async ({ productSearchPage }) => {
    // given

    // when
    await productSearchPage.goto({ q: searchToken(), maxPrice: 'cheap' });

    // then
    await expect(productSearchPage.validationError('maxPrice')).toHaveText('maxPrice: must be a number');
    await expect(productSearchPage.productNames).toHaveCount(0);
  });

  test('sorts the results and keeps the sort in the URL', async ({ api, productSearchPage }) => {
    // given
    const token = searchToken();
    const cheap = await createSearchProduct(api, { name: `Cheap ${token}`, category: 'Sorted', price: 5 });
    const dear = await createSearchProduct(api, { name: `Dear ${token}`, category: 'Sorted', price: 50 });
    const middle = await createSearchProduct(api, { name: `Middle ${token}`, category: 'Sorted', price: 20 });
    await productSearchPage.goto({ q: token });

    // when
    await productSearchPage.sortBy('Price (High to Low)');

    // then
    await expect(productSearchPage.productNames).toHaveText([dear.name, middle.name, cheap.name]);
    expect(productSearchPage.currentQuery().get('sort')).toBe('price-desc');

    // when
    await productSearchPage.sortBy('Name (A-Z)');

    // then
    await expect(productSearchPage.productNames).toHaveText([cheap.name, dear.name, middle.name]);
    expect(productSearchPage.currentQuery().get('sort')).toBe('name-asc');
  });

  test('restores every filter from the URL and keeps it after a reload', async ({ api, shopperPage, productSearchPage }) => {
    // given
    const token = searchToken();
    const garden = `Garden ${token}`;
    const kept = await createSearchProduct(api, { name: `Kept ${token}`, category: garden, price: 30, stockQuantity: 2 });
    const cheaper = await createSearchProduct(api, { name: `Cheaper ${token}`, category: garden, price: 15, stockQuantity: 2 });
    await createSearchProduct(api, { name: `Sold out ${token}`, category: garden, price: 20, stockQuantity: 0 });
    await createSearchProduct(api, { name: `Too dear ${token}`, category: garden, price: 90 });
    await createSearchProduct(api, { name: `Other ${token}`, category: `Tools ${token}`, price: 25 });

    // when
    await productSearchPage.goto({ q: token, category: garden, minPrice: '10', maxPrice: '50', inStock: '1', sort: 'price-desc' });

    // then
    await expectRestoredState();

    // when
    await shopperPage.reload();

    // then
    await expectRestoredState();

    async function expectRestoredState() {
      await expect(productSearchPage.productNames).toHaveText([kept.name, cheaper.name]);
      await expect(productSearchPage.searchInput).toHaveValue(token);
      await expect(productSearchPage.categoryCheckbox(garden)).toBeChecked();
      await expect(productSearchPage.minPrice).toHaveValue('10');
      await expect(productSearchPage.maxPrice).toHaveValue('50');
      await expect(productSearchPage.inStockOnly).toBeChecked();
      await expect(productSearchPage.sortSelect).toHaveValue('price-desc');
      await expect(productSearchPage.title).toHaveText(`${garden} Products`);
    }
  });

  test('offers to clear the filters when nothing matches', async ({ productSearchPage }) => {
    // given
    await productSearchPage.goto({ q: searchToken(), minPrice: '1' });
    await expect(productSearchPage.noProductsMessage).toContainText('No products found');
    await expect(productSearchPage.summary).toHaveText('No matching products');
    await expect(productSearchPage.categoriesEmpty).toHaveText('No categories match');

    // when
    await productSearchPage.resetSearch();

    // then
    await expect(productSearchPage.noProductsMessage).toBeHidden();
    await expect(productSearchPage.searchInput).toHaveValue('');
    await expect(productSearchPage.minPrice).toHaveValue('');
    await expect(productSearchPage.productNames.first()).toBeVisible();
    expect([...productSearchPage.currentQuery().keys()]).toEqual([]);
  });

  test('clears all filters from the sidebar', async ({ api, productSearchPage }) => {
    // given
    const token = searchToken();
    await createSearchProduct(api, { name: `Item ${token}`, category: `Garden ${token}` });
    await productSearchPage.goto({ q: token, category: `Garden ${token}`, inStock: '1', sort: 'price-asc' });
    await expect(productSearchPage.productNames).toHaveCount(1);

    // when
    await productSearchPage.clearFilters();

    // then
    await expect(productSearchPage.searchInput).toHaveValue('');
    await expect(productSearchPage.inStockOnly).not.toBeChecked();
    await expect(productSearchPage.sortSelect).toHaveValue('relevance');
    await expect(productSearchPage.title).toHaveText('All Products');
    await expect(productSearchPage.clearFiltersButton).toBeHidden();
    expect([...productSearchPage.currentQuery().keys()]).toEqual([]);
  });

  test('hides sold-out products with the in-stock filter', async ({ api, productSearchPage }) => {
    // given
    const token = searchToken();
    const available = await createSearchProduct(api, { name: `Available ${token}`, category: 'Stock', stockQuantity: 3 });
    const soldOut = await createSearchProduct(api, { name: `Sold out ${token}`, category: 'Stock', stockQuantity: 0 });
    await productSearchPage.goto({ q: token, sort: 'name-asc' });
    await expect(productSearchPage.productNames).toHaveText([available.name, soldOut.name]);
    await expect(productSearchPage.inStockCount).toHaveText('1');

    // when
    await productSearchPage.showInStockOnly();

    // then
    await expect(productSearchPage.productNames).toHaveText([available.name]);
    expect(productSearchPage.currentQuery().get('inStock')).toBe('1');
  });

  test('pages through results twelve at a time', async ({ api, productSearchPage }) => {
    // given
    const token = searchToken();
    for (let index = 1; index <= 13; index++) {
      await createSearchProduct(api, { name: `Item ${String(index).padStart(2, '0')} ${token}`, category: 'Paged', price: index });
    }
    await productSearchPage.goto({ q: token, sort: 'price-asc' });
    await expect(productSearchPage.productNames).toHaveCount(12);
    await expect(productSearchPage.pageStatus).toHaveText('Page 1 of 2');
    await expect(productSearchPage.previousPageButton).toBeDisabled();

    // when
    await productSearchPage.nextPage();

    // then
    await expect(productSearchPage.productNames).toHaveText([`Item 13 ${token}`]);
    await expect(productSearchPage.pageStatus).toHaveText('Page 2 of 2');
    await expect(productSearchPage.summary).toHaveText('Showing 13–13 of 13');
    await expect(productSearchPage.nextPageButton).toBeDisabled();
    expect(productSearchPage.currentQuery().get('page')).toBe('2');
  });

  test('leads back to the first page from a page past the end', async ({ api, productSearchPage }) => {
    // given
    const token = searchToken();
    const only = await createSearchProduct(api, { name: `Only ${token}`, category: 'Paged' });
    await productSearchPage.goto({ q: token, page: '5' });
    await expect(productSearchPage.noProductsMessage).toContainText('No products found');

    // when
    await productSearchPage.firstPage();

    // then
    await expect(productSearchPage.productNames).toHaveText([only.name]);
    expect(productSearchPage.currentQuery().get('page')).toBeNull();
  });

  test('shows ratings and filters by the minimum rating', async ({ api, shopper, warehouse, productSearchPage }) => {
    // given
    const token = searchToken();
    const rated = await createSearchProduct(api, { name: `Rated ${token}`, category: 'Rated', stockQuantity: 5 });
    const unrated = await createSearchProduct(api, { name: `Unrated ${token}`, category: 'Rated', stockQuantity: 5 });
    await deliverAndReview(shopper, warehouse, [{ product: rated, rating: 5 }]);
    await productSearchPage.goto({ q: token, sort: 'name-asc' });
    await expect(productSearchPage.productNames).toHaveText([rated.name, unrated.name]);
    await expect(productSearchPage.productRatings).toHaveText(['★ 5.0 (1)', 'No reviews yet']);

    // when
    await productSearchPage.minRating.selectOption('4');

    // then
    await expect(productSearchPage.productNames).toHaveText([rated.name]);
    expect(productSearchPage.currentQuery().get('minRating')).toBe('4');
    expect((await searchProducts(shopper.search, { q: token, minRating: 4 })).totalElements).toBe(1);
  });

  test('shows an error when the search fails', { tag: '@slow' }, async ({ shopperPage, productSearchPage }) => {
    // given
    await shopperPage.route('**/api/v1/products/search**', (route) => route.fulfill({ status: 500, json: { message: 'Internal error' } }));

    // when
    await productSearchPage.goto({ q: searchToken() });

    // then
    // React Query retries server errors three times with backoff before it gives up.
    await expect(productSearchPage.errorMessage).toHaveText('Error loading products', { timeout: 15_000 });
  });
});
