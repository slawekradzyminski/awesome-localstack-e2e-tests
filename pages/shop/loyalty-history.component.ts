import type { Locator, Page } from '@playwright/test';

/** Paginated loyalty transaction history of /account/loyalty. */
export class LoyaltyHistory {
  readonly table: Locator;
  readonly rows: Locator;
  readonly empty: Locator;
  readonly loading: Locator;
  readonly error: Locator;
  readonly pagination: Locator;
  readonly pageIndicator: Locator;
  readonly previousButton: Locator;
  readonly nextButton: Locator;

  constructor(private readonly page: Page) {
    this.table = page.getByTestId('loyalty-transactions-table');
    this.rows = this.table.locator('tbody tr');
    this.empty = page.getByTestId('loyalty-transactions-empty');
    this.loading = page.getByTestId('loyalty-transactions-loading');
    this.error = page.getByTestId('loyalty-transactions-error');
    this.pagination = page.getByTestId('loyalty-transactions-pagination');
    this.pageIndicator = page.getByTestId('loyalty-transactions-page');
    this.previousButton = page.getByTestId('loyalty-transactions-prev');
    this.nextButton = page.getByTestId('loyalty-transactions-next');
  }

  row(transactionId: number): LoyaltyTransactionRow {
    return {
      root: this.page.getByTestId(`loyalty-transaction-${transactionId}`),
      type: this.page.getByTestId(`loyalty-transaction-type-${transactionId}`),
      order: this.page.getByTestId(`loyalty-transaction-order-${transactionId}`),
      points: this.page.getByTestId(`loyalty-transaction-points-${transactionId}`),
    };
  }

  async nextPage(): Promise<void> {
    await this.nextButton.click();
  }

  async previousPage(): Promise<void> {
    await this.previousButton.click();
  }
}

export interface LoyaltyTransactionRow {
  root: Locator;
  type: Locator;
  order: Locator;
  points: Locator;
}
