import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** /admin/inventory: searchable stock list and the inspector of the selected product. */
export class AdminInventoryPage extends BasePage {
  readonly search: Locator;
  readonly selectedName: Locator;

  constructor(page: Page) {
    super(page);
    this.search = page.getByTestId('inventory-search');
    this.selectedName = page.getByTestId('inventory-selected-name');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/inventory');
    await this.search.waitFor();
  }

  async searchFor(name: string): Promise<void> {
    await this.search.fill(name);
  }

  /** The product name in its row: the link that opens the product in the inspector. */
  productLink(productId: number): Locator {
    return this.page.getByTestId(`inventory-row-${productId}`).getByRole('link');
  }
}
