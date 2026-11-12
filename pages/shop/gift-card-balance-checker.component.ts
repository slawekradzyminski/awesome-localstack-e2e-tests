import type { Locator, Page } from '@playwright/test';

/** Gift card balance checker of /account/loyalty. */
export class GiftCardBalanceChecker {
  readonly input: Locator;
  readonly submitButton: Locator;
  readonly error: Locator;
  readonly result: Locator;
  readonly code: Locator;
  readonly balance: Locator;
  readonly status: Locator;
  readonly expires: Locator;

  constructor(page: Page) {
    this.input = page.getByTestId('gift-card-checker-input');
    this.submitButton = page.getByTestId('gift-card-checker-submit');
    this.error = page.getByTestId('gift-card-checker-error');
    this.result = page.getByTestId('gift-card-checker-result');
    this.code = page.getByTestId('gift-card-checker-code');
    this.balance = page.getByTestId('gift-card-checker-balance');
    this.status = page.getByTestId('gift-card-checker-status');
    this.expires = page.getByTestId('gift-card-checker-expires');
  }

  async check(code: string): Promise<void> {
    await this.input.fill(code);
    await this.submitButton.click();
  }
}
