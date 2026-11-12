import type { Locator, Page } from '@playwright/test';
import type { AddressDto } from '@models/order';
import { BasePage } from '@pages/base.page';
import { TendersSummary } from './tenders-summary.component';

/** /checkout: shipping address with its VAT preview, the cart's tenders and the amount to pay. */
export class CheckoutPage extends BasePage {
  readonly form: Locator;
  readonly street: Locator;
  readonly city: Locator;
  readonly state: Locator;
  readonly zipCode: Locator;
  readonly country: Locator;
  readonly taxPreview: Locator;
  readonly taxLabel: Locator;
  readonly taxAmount: Locator;
  readonly taxUnavailable: Locator;
  readonly summary: TendersSummary;
  readonly cartTotal: Locator;
  /** What is left to pay by card, in the display currency. */
  readonly payableTotal: Locator;
  readonly chargedInUsd: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.form = page.getByTestId('checkout-form');
    this.street = page.getByTestId('checkout-street-input');
    this.city = page.getByTestId('checkout-city-input');
    this.state = page.getByTestId('checkout-state-input');
    this.zipCode = page.getByTestId('checkout-zip-input');
    this.country = page.getByTestId('checkout-country-input');
    this.taxPreview = page.getByTestId('checkout-tax-preview');
    this.taxLabel = page.getByTestId('checkout-tax-label');
    this.taxAmount = page.getByTestId('checkout-tax-amount');
    this.taxUnavailable = page.getByTestId('checkout-tax-unavailable');
    this.summary = new TendersSummary(page, 'checkout');
    this.cartTotal = page.getByTestId('checkout-total-value');
    this.payableTotal = page.getByTestId('checkout-total-amount');
    this.chargedInUsd = page.getByTestId('checkout-charged-in-usd');
    this.submitButton = page.getByTestId('checkout-submit-button');
  }

  async goto(): Promise<void> {
    await this.page.goto('/checkout');
    await this.form.waitFor();
  }

  async fillAddress(address: AddressDto): Promise<void> {
    await this.street.fill(address.street);
    await this.city.fill(address.city);
    await this.state.fill(address.state);
    await this.zipCode.fill(address.zipCode);
    await this.country.fill(address.country);
  }

  /** Submits the form; returns the new order's id from the page checkout navigates to (/orders/{id} or /orders/{id}/pay). */
  async placeOrder(): Promise<number> {
    await this.submitButton.click();
    await this.page.waitForURL(/\/orders\/\d+/);
    return Number(/\/orders\/(\d+)/.exec(this.page.url())![1]);
  }
}
