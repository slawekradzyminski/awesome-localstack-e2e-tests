import type { Locator, Page } from '@playwright/test';
import { ProductCard } from './product-card.component';
import { BasePage } from '@pages/base.page';

/** Frontend URL query of /products: sort=price-asc, inStock=1, one-based page, repeated category. */
export type ProductSearchUrlQuery = Record<string, string | string[]>;

/** Server-side catalogue search on /products; every filter lives in the URL query. */
export class ProductSearchPage extends BasePage {
  readonly searchInput: Locator;
  readonly clearSearchButton: Locator;
  readonly sortSelect: Locator;
  readonly title: Locator;
  readonly summary: Locator;
  readonly allCategoriesButton: Locator;
  readonly categoriesEmpty: Locator;
  readonly minPrice: Locator;
  readonly maxPrice: Locator;
  readonly applyPriceButton: Locator;
  readonly minPriceError: Locator;
  readonly minRating: Locator;
  readonly inStockOnly: Locator;
  readonly inStockCount: Locator;
  readonly clearFiltersButton: Locator;
  readonly productNames: Locator;
  readonly productPrices: Locator;
  readonly productRatings: Locator;
  readonly noProductsMessage: Locator;
  readonly emptySearchActions: Locator;
  readonly resetSearchButton: Locator;
  readonly firstPageButton: Locator;
  readonly errorMessage: Locator;
  readonly validationErrors: Locator;
  readonly nextPageButton: Locator;
  readonly previousPageButton: Locator;
  readonly pageStatus: Locator;

  constructor(page: Page) {
    super(page);
    const list = page.getByTestId('product-list');
    this.searchInput = page.getByTestId('product-search');
    this.clearSearchButton = page.getByTestId('clear-search');
    this.sortSelect = page.getByTestId('product-sort');
    this.title = page.getByTestId('product-list-title');
    this.summary = page.getByTestId('product-search-summary');
    this.allCategoriesButton = page.getByTestId('products-category-all');
    this.categoriesEmpty = page.getByTestId('products-categories-empty');
    this.minPrice = page.getByTestId('product-min-price');
    this.maxPrice = page.getByTestId('product-max-price');
    this.applyPriceButton = page.getByTestId('product-price-apply');
    this.minPriceError = page.getByTestId('product-min-price-error');
    this.minRating = page.getByTestId('product-min-rating');
    this.inStockOnly = page.getByTestId('product-in-stock-only');
    this.inStockCount = page.getByTestId('product-in-stock-count');
    this.clearFiltersButton = page.getByTestId('product-clear-filters');
    this.productNames = list.getByTestId('product-name');
    this.productPrices = list.getByTestId('product-price');
    this.productRatings = list.getByTestId('product-rating');
    this.noProductsMessage = page.getByTestId('no-products-message');
    this.emptySearchActions = page.getByTestId('empty-search-actions');
    this.resetSearchButton = page.getByTestId('reset-search-button');
    this.firstPageButton = page.getByTestId('product-first-page-button');
    this.errorMessage = page.getByTestId('error-message');
    this.validationErrors = page.getByTestId('product-search-errors');
    this.nextPageButton = page.getByTestId('product-pagination-next');
    this.previousPageButton = page.getByTestId('product-pagination-prev');
    this.pageStatus = page.getByTestId('product-pagination-status');
  }

  async goto(query: ProductSearchUrlQuery = {}): Promise<void> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
    }
    const search = params.toString();
    await this.page.goto(search ? `/products?${search}` : '/products');
  }

  categoryCheckbox(category: string): Locator {
    return this.page.getByTestId(`products-category-${slug(category)}`);
  }

  categoryCount(category: string): Locator {
    return this.page.getByTestId(`products-category-count-${slug(category)}`);
  }

  validationError(field: string): Locator {
    return this.page.getByTestId(`product-search-error-${field}`);
  }

  /** The URL query as the page wrote it, to check that filters are kept in the address. */
  currentQuery(): URLSearchParams {
    return new URL(this.page.url()).searchParams;
  }

  product(name: string): ProductCard {
    return new ProductCard(this.page.getByTestId('product-list'), name);
  }

  async search(text: string): Promise<void> {
    await this.searchInput.fill(text);
    await this.searchInput.press('Enter');
  }

  async sortBy(label: string): Promise<void> {
    await this.sortSelect.selectOption({ label });
  }

  async selectCategory(category: string): Promise<void> {
    await this.toggleOn(this.categoryCheckbox(category));
  }

  async showInStockOnly(): Promise<void> {
    await this.toggleOn(this.inStockOnly);
  }

  async setPriceRange(min: string, max: string): Promise<void> {
    await this.minPrice.fill(min);
    await this.maxPrice.fill(max);
    await this.applyPriceButton.click();
  }

  async clearFilters(): Promise<void> {
    await this.clearFiltersButton.click();
  }

  async resetSearch(): Promise<void> {
    await this.resetSearchButton.click();
  }

  async nextPage(): Promise<void> {
    await this.nextPageButton.click();
  }

  async firstPage(): Promise<void> {
    await this.firstPageButton.click();
  }

  // The checkboxes mirror the URL, which React Router updates after the click. locator.check() would
  // verify the state before that happens, so the click is followed by a wait for the checked state.
  private async toggleOn(checkbox: Locator): Promise<void> {
    await checkbox.click();
    await checkbox.and(this.page.locator(':checked')).waitFor({ state: 'attached' });
  }
}

const slug = (category: string) => category.toLowerCase().replace(/\s+/g, '-');
