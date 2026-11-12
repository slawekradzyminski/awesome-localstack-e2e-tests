import type { Locator, Page } from '@playwright/test';

/** The /products filters: a sidebar on wide screens, folded behind a "Filters" button below xl. */
export class CatalogFilters {
  readonly toggle: Locator;
  readonly panel: Locator;
  readonly container: Locator;

  constructor(private readonly page: Page) {
    this.toggle = page.getByTestId('products-filters-toggle');
    this.panel = page.getByTestId('products-filters-panel');
    this.container = page.getByTestId('products-categories-container');
  }

  /** The checkbox row of a category (slug: lower case, spaces as dashes). */
  categoryItem(category: string): Locator {
    return this.page.getByTestId(`products-category-item-${category.toLowerCase().replace(/\s+/g, '-')}`);
  }

  category(category: string): Locator {
    return this.page.getByTestId(`products-category-${category.toLowerCase().replace(/\s+/g, '-')}`);
  }
}
