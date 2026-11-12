import type { Locator, Page } from '@playwright/test';

/** Loyalty points panel of /cart. */
export class CartLoyaltyPanel {
  readonly root: Locator;
  readonly balance: Locator;
  readonly unavailable: Locator;
  readonly minimum: Locator;
  readonly form: Locator;
  readonly input: Locator;
  readonly useMaxButton: Locator;
  readonly applyButton: Locator;
  readonly validation: Locator;
  readonly preview: Locator;
  readonly applied: Locator;
  readonly redeemed: Locator;
  readonly removeButton: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId('cart-loyalty-panel');
    this.balance = page.getByTestId('cart-loyalty-balance');
    this.unavailable = page.getByTestId('cart-loyalty-unavailable');
    this.minimum = page.getByTestId('cart-loyalty-minimum');
    this.form = page.getByTestId('cart-loyalty-form');
    this.input = page.getByTestId('cart-loyalty-points-input');
    this.useMaxButton = page.getByTestId('cart-loyalty-use-max');
    this.applyButton = page.getByTestId('cart-loyalty-apply');
    this.validation = page.getByTestId('cart-loyalty-validation');
    this.preview = page.getByTestId('cart-loyalty-preview');
    this.applied = page.getByTestId('cart-loyalty-applied');
    this.redeemed = page.getByTestId('cart-loyalty-redeemed');
    this.removeButton = page.getByTestId('cart-loyalty-remove');
    this.error = page.getByTestId('cart-loyalty-error');
  }

  /** Fills the input with the largest redeemable amount (whole hundreds of the balance). */
  async useMax(): Promise<void> {
    await this.useMaxButton.click();
  }

  /** Applies the points already in the input. */
  async applyEnteredPoints(): Promise<void> {
    await this.applyButton.click();
  }

  async apply(points: number): Promise<void> {
    await this.input.fill(String(points));
    await this.applyButton.click();
  }

  async remove(): Promise<void> {
    await this.removeButton.click();
  }
}
