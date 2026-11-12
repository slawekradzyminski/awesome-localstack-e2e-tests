import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** /admin/orders: every customer's orders with a View Details link per row. */
export class AdminOrderListPage extends BasePage {
  readonly table: Locator;
  readonly statusFilter: Locator;

  constructor(page: Page) {
    super(page);
    this.table = page.getByTestId('admin-order-list-table');
    this.statusFilter = page.getByTestId('admin-order-list-status-filter');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/orders');
    await this.table.waitFor();
  }

  detailsLink(orderId: number): Locator {
    return this.page.getByTestId(`admin-order-details-${orderId}`);
  }
}
