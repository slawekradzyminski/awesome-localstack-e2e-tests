import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** /admin/products: the product table with Edit and Delete per row. */
export class AdminProductListPage extends BasePage {
  readonly table: Locator;

  constructor(page: Page) {
    super(page);
    this.table = page.getByTestId('admin-product-list-table');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/products');
    await this.table.waitFor();
  }

  editLink(productId: number): Locator {
    return this.page.getByTestId(`admin-product-edit-${productId}`);
  }

  deleteButton(productId: number): Locator {
    return this.page.getByTestId(`admin-product-delete-${productId}`);
  }
}
