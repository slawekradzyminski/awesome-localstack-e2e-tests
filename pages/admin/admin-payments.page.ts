import type { Locator, Page } from '@playwright/test';
import type { PaymentStatus } from '@models/payment';
import { BasePage } from '@pages/base.page';

/** /admin/payments: every card payment, newest first, with a status filter. */
export class AdminPaymentsPage extends BasePage {
  readonly root: Locator;
  readonly statusFilter: Locator;
  readonly rows: Locator;

  constructor(page: Page) {
    super(page);
    this.root = page.getByTestId('admin-payments');
    this.statusFilter = page.getByTestId('admin-payments-status');
    this.rows = this.root.locator('tbody tr');
  }

  /** Navigates only: a customer is redirected away, so there is no list to wait for. */
  async goto(): Promise<void> {
    await this.page.goto('/admin/payments');
  }

  row(paymentId: string): Locator {
    return this.page.getByTestId(`admin-payment-row-${paymentId}`);
  }

  status(paymentId: string): Locator {
    return this.page.getByTestId(`admin-payment-status-${paymentId}`);
  }

  amount(paymentId: string): Locator {
    return this.page.getByTestId(`admin-payment-amount-${paymentId}`);
  }

  async filterBy(status: PaymentStatus | ''): Promise<void> {
    await this.statusFilter.selectOption(status);
  }
}
