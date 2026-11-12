import type { Locator, Page } from '@playwright/test';

/** The administrator's status select and Update button on /orders/:id. */
export class OrderStatusControl {
  readonly select: Locator;
  readonly update: Locator;
  readonly notFound: Locator;
  readonly loading: Locator;

  constructor(page: Page) {
    this.select = page.getByRole('combobox', { name: 'Order status' });
    this.update = page.getByTestId('order-details-update-status-button');
    this.notFound = page.getByTestId('order-details-not-found');
    this.loading = page.getByTestId('order-details-loading');
  }
}
