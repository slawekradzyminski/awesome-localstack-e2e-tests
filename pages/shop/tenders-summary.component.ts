import type { Locator, Page } from '@playwright/test';

/** Gift card and points lines plus the amount still due by card, on the cart and on the checkout. */
export class TendersSummary {
  readonly root: Locator;
  readonly giftCard: Locator;
  readonly points: Locator;
  readonly amountDue: Locator;

  constructor(page: Page, prefix: 'cart' | 'checkout') {
    this.root = page.getByTestId(`${prefix}-tenders-summary`);
    this.giftCard = page.getByTestId(`${prefix}-tenders-gift-card`);
    this.points = page.getByTestId(`${prefix}-tenders-points`);
    this.amountDue = page.getByTestId(`${prefix}-tenders-amount-due`);
  }
}
