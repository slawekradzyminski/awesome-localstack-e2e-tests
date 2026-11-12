import type { Locator, Page } from '@playwright/test';

export interface GiftCardFormValues {
  amount: string;
  recipient?: string;
  /** datetime-local value in the browser's time zone. */
  expires?: string;
  note?: string;
}

/** Issue form of /admin/gift-cards. */
export class GiftCardIssueForm {
  readonly amount: Locator;
  readonly recipient: Locator;
  readonly expires: Locator;
  readonly note: Locator;
  readonly submitButton: Locator;
  readonly formError: Locator;
  readonly amountError: Locator;
  readonly expiresError: Locator;

  constructor(page: Page) {
    this.amount = page.getByTestId('admin-gift-card-amount');
    this.recipient = page.getByTestId('admin-gift-card-recipient');
    this.expires = page.getByTestId('admin-gift-card-expires');
    this.note = page.getByTestId('admin-gift-card-note');
    this.submitButton = page.getByTestId('admin-gift-card-issue');
    this.formError = page.getByTestId('admin-gift-card-form-error');
    this.amountError = page.getByTestId('admin-gift-card-amount-error');
    this.expiresError = page.getByTestId('admin-gift-card-expiresAt-error');
  }

  async issue(card: GiftCardFormValues): Promise<void> {
    await this.amount.fill(card.amount);
    if (card.recipient !== undefined) await this.recipient.fill(card.recipient);
    if (card.expires !== undefined) await this.expires.fill(card.expires);
    if (card.note !== undefined) await this.note.fill(card.note);
    await this.submitButton.click();
  }
}
