import type { Locator, Page } from '@playwright/test';

/** Columns of the ledger table after the date. */
const LEDGER_COLUMNS = { type: 1, amount: 2, balanceAfter: 3, reference: 4 } as const;

/** Details drawer of one gift card on /admin/gift-cards: balance, ledger and the disable action. */
export class GiftCardDetailsDrawer {
  readonly root: Locator;
  readonly title: Locator;
  readonly status: Locator;
  readonly balance: Locator;
  readonly ledger: Locator;
  readonly ledgerRows: Locator;
  readonly disableButton: Locator;
  readonly disableError: Locator;
  readonly confirmDialog: Locator;
  readonly confirmMessage: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId('admin-gift-card-details');
    this.title = page.getByTestId('admin-gift-card-details-title');
    this.status = page.getByTestId('admin-gift-card-details-status');
    this.balance = page.getByTestId('admin-gift-card-details-balance');
    this.ledger = page.getByTestId('admin-gift-card-ledger');
    this.ledgerRows = this.ledger.locator('tbody tr');
    this.disableButton = page.getByTestId('admin-gift-card-disable');
    this.disableError = page.getByTestId('admin-gift-card-disable-error');
    this.confirmDialog = page.getByTestId('admin-gift-card-disable-confirm');
    this.confirmMessage = page.getByTestId('admin-gift-card-disable-confirm-message');
    this.confirmButton = page.getByTestId('admin-gift-card-disable-confirm-confirm');
    this.cancelButton = page.getByTestId('admin-gift-card-disable-confirm-cancel');
    this.closeButton = page.getByTestId('admin-gift-card-details-close');
  }

  /** One cell of the ledger; rows are oldest first. `reference` is the actor or the order. */
  ledgerCell(row: number, column: keyof typeof LEDGER_COLUMNS): Locator {
    return this.ledgerRows.nth(row).locator('td').nth(LEDGER_COLUMNS[column]);
  }

  /** Opens the confirmation dialog; the card is disabled only after confirmDisable(). */
  async startDisabling(): Promise<void> {
    await this.disableButton.click();
  }

  async confirmDisable(): Promise<void> {
    await this.confirmButton.click();
  }

  async cancelDisable(): Promise<void> {
    await this.cancelButton.click();
  }
}
