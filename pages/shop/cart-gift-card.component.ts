import type { Locator, Page } from '@playwright/test';

/** Gift card panel of /cart. */
export class CartGiftCardPanel {
  readonly root: Locator;
  readonly input: Locator;
  readonly applyButton: Locator;
  readonly applied: Locator;
  readonly appliedCode: Locator;
  readonly coveredAmount: Locator;
  readonly unusable: Locator;
  readonly removeButton: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId('cart-gift-card-panel');
    this.input = page.getByTestId('cart-gift-card-input');
    this.applyButton = page.getByTestId('cart-gift-card-apply');
    this.applied = page.getByTestId('cart-gift-card-applied');
    this.appliedCode = page.getByTestId('cart-gift-card-code');
    this.coveredAmount = page.getByTestId('cart-gift-card-amount');
    this.unusable = page.getByTestId('cart-gift-card-unusable');
    this.removeButton = page.getByTestId('cart-gift-card-remove');
    this.error = page.getByTestId('cart-gift-card-error');
  }

  async apply(code: string): Promise<void> {
    await this.input.fill(code);
    await this.applyButton.click();
  }

  async remove(): Promise<void> {
    await this.removeButton.click();
  }
}
