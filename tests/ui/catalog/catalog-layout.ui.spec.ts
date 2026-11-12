import { test, expect } from '@fixtures';
import { randomUUID } from 'node:crypto';
import { CatalogFilters } from '@pages/shop/catalog-filters.component';
import { ProductDetailsPage } from '@pages/shop/product-details.page';
import { expectContainedIn, expectReachable, expectReadableText, PHONE } from '@support/layout';

test.describe('catalog layout', { tag: ['@catalog'] }, () => {
  test('a long category stays inside its product card and the category filter (T-059)', async ({ api, productSearchPage, shopperPage }) => {
    // given
    // A short name stays on one line, so the centre of its link is on the text.
    const name = `Lamp ${randomUUID().slice(0, 6)}`;
    const category = `ProbeLongCategoryLongCategoryLongCategory${randomUUID().slice(0, 6)}`;
    await api.createProduct({ name, category });
    await shopperPage.setViewportSize({ width: 1440, height: 900 });
    const filters = new CatalogFilters(shopperPage);

    // when
    await productSearchPage.goto({ q: name });

    // then
    const card = productSearchPage.product(name);
    await expect(card.root.getByTestId('product-category')).toHaveAttribute('title', category);
    await expectContainedIn(card.root.getByTestId('product-category'), card.root);
    await expectContainedIn(filters.categoryItem(category), filters.container);
    await expectReachable(card.name.getByRole('link'));
  });

  test('phones see the search box before the folded filters (T-062)', async ({ productSearchPage, shopperPage }) => {
    // given
    await shopperPage.setViewportSize(PHONE);
    const filters = new CatalogFilters(shopperPage);

    // when
    await productSearchPage.goto();

    // then
    await expect(productSearchPage.productNames.first()).toBeVisible();
    await expect(filters.toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(filters.panel).toBeHidden();
    await expect(productSearchPage.searchInput).toBeInViewport();

    // when
    await filters.toggle.click();

    // then
    await expect(filters.toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(productSearchPage.allCategoriesButton).toBeVisible();
  });

  test('desktop keeps the filters open beside the results (T-062)', async ({ productSearchPage, shopperPage }) => {
    // given
    await shopperPage.setViewportSize({ width: 1280, height: 900 });
    const filters = new CatalogFilters(shopperPage);

    // when
    await productSearchPage.goto();

    // then
    await expect(productSearchPage.allCategoriesButton).toBeVisible();
    await expect(filters.toggle).toBeHidden();
  });

  test('the "No image available" placeholder is readable (T-050)', async ({ api, shopperPage }) => {
    // given
    const product = await api.createProduct({ imageUrl: '' });
    const details = new ProductDetailsPage(shopperPage);

    // when
    await details.goto(product.id);

    // then
    await expect(details.noImage).toHaveText('No image available');
    await expectReadableText(details.noImage);
  });
});
