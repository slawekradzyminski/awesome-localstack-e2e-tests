import type { Locator, Page } from '@playwright/test';

/** The VAT contained in the order total, as shown on /orders/:id. */
export class OrderVat {
  readonly root: Locator;
  readonly country: Locator;
  readonly amount: Locator;
  readonly net: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId('order-details-vat');
    this.country = page.getByTestId('order-details-vat-country');
    this.amount = page.getByTestId('order-details-vat-amount');
    this.net = page.getByTestId('order-details-vat-net');
  }
}
