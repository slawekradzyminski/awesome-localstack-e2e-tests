import type { Locator, Page } from '@playwright/test';

/** Simulated 3-D Secure challenge shown over the payment page. */
export class ThreeDsDialog {
  readonly root: Locator;
  readonly code: Locator;
  readonly hint: Locator;
  readonly verifyButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.root = page.getByRole('dialog', { name: '3-D Secure verification' });
    this.code = this.root.getByLabel('Verification code');
    this.hint = this.root.getByTestId('payment-3ds-hint');
    this.verifyButton = this.root.getByTestId('payment-3ds-submit');
    this.cancelButton = this.root.getByTestId('payment-3ds-cancel');
  }

  async verify(code: string): Promise<void> {
    await this.code.fill(code);
    await this.verifyButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
