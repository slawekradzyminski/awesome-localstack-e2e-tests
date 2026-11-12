import type { Locator, Page } from '@playwright/test';

export interface CardDetails {
  number: string;
  expiry?: string;
  cvc?: string;
  holder?: string;
}

/** Card form of /orders/:id/pay with its collapsible list of test cards. */
export class CardForm {
  readonly root: Locator;
  readonly cardNumber: Locator;
  readonly expiry: Locator;
  readonly cvc: Locator;
  readonly holder: Locator;
  readonly submitButton: Locator;
  readonly cardNumberError: Locator;
  readonly expiryError: Locator;
  readonly cvcError: Locator;
  readonly holderError: Locator;
  readonly testCardsToggle: Locator;
  readonly testCardsList: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId('payment-card-form');
    this.cardNumber = this.root.getByLabel('Card number');
    this.expiry = this.root.getByLabel('Expiry (MM/YY)');
    this.cvc = this.root.getByLabel('CVC');
    this.holder = this.root.getByLabel('Name on card');
    this.submitButton = page.getByTestId('payment-submit');
    this.cardNumberError = page.getByTestId('payment-card-number-error');
    this.expiryError = page.getByTestId('payment-card-expiry-error');
    this.cvcError = page.getByTestId('payment-card-cvc-error');
    this.holderError = page.getByTestId('payment-card-holder-error');
    this.testCardsToggle = page.getByTestId('payment-test-cards-toggle');
    this.testCardsList = page.getByTestId('payment-test-cards-list');
  }

  testCardButton(digits: string): Locator {
    return this.page.getByTestId(`payment-test-card-${digits}`);
  }

  async fill({ number, expiry = '12/35', cvc = '123', holder = 'Playwright Customer' }: CardDetails): Promise<void> {
    await this.cardNumber.fill(number);
    await this.expiry.fill(expiry);
    await this.cvc.fill(cvc);
    await this.holder.fill(holder);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async payWith(card: CardDetails): Promise<void> {
    await this.fill(card);
    await this.submit();
  }

  async toggleTestCards(): Promise<void> {
    await this.testCardsToggle.click();
  }

  async pickTestCard(digits: string): Promise<void> {
    await this.testCardButton(digits).click();
  }

  /** Opens the test-card list when it is closed, picks a card (which fills the form) and submits it. */
  async payWithTestCard(digits: string): Promise<void> {
    if (!(await this.testCardsList.isVisible())) await this.toggleTestCards();
    await this.pickTestCard(digits);
    await this.submit();
  }
}
