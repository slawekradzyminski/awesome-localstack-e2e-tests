import type { Locator, Page } from '@playwright/test';

/** Payment panel of /orders/:id: the latest card payment, every attempt and the Pay now link. */
export class OrderPaymentPanel {
  readonly root: Locator;
  readonly payNowLink: Locator;
  readonly awaiting: Locator;
  readonly none: Locator;
  readonly status: Locator;
  readonly card: Locator;
  readonly amount: Locator;
  readonly failure: Locator;
  readonly attempts: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId('order-payment-panel');
    this.payNowLink = this.root.getByTestId('order-payment-pay-now');
    this.awaiting = this.root.getByTestId('order-payment-awaiting');
    this.none = this.root.getByTestId('order-payment-none');
    this.status = this.root.getByTestId('order-payment-status');
    this.card = this.root.getByTestId('order-payment-card');
    this.amount = this.root.getByTestId('order-payment-amount');
    this.failure = this.root.getByTestId('order-payment-failure');
    this.attempts = this.root.getByTestId('order-payment-attempts').getByRole('listitem');
  }

  attemptStatus(paymentId: string): Locator {
    return this.root.getByTestId(`order-payment-attempt-status-${paymentId}`);
  }

  async payNow(): Promise<void> {
    await this.payNowLink.click();
  }
}
