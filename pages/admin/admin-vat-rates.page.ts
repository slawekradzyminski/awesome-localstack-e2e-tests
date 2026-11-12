import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** /admin/vat-rates: every country's rate, inline editors and the new-country form. */
export class AdminVatRatesPage extends BasePage {
  readonly heading: Locator;
  readonly rows: Locator;
  readonly newCountryCode: Locator;
  readonly newCountryName: Locator;
  readonly newRate: Locator;
  readonly newSaveButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'VAT rates' });
    this.rows = page.locator('[data-testid^="admin-vat-row-"]');
    this.newCountryCode = page.getByTestId('admin-vat-new-country-code');
    this.newCountryName = page.getByTestId('admin-vat-new-country-name');
    this.newRate = page.getByTestId('admin-vat-new-rate');
    this.newSaveButton = page.getByTestId('admin-vat-new-save');
  }

  /** Opens the page and waits for the list: a save made while the first load is in flight is lost (bugs/BUG-TAX-01). */
  async goto(): Promise<void> {
    await this.open();
    await this.rows.first().waitFor();
  }

  /** Navigates without waiting for the list. */
  async open(): Promise<void> {
    await this.page.goto('/admin/vat-rates');
  }

  row(countryCode: string): Locator {
    return this.page.getByTestId(`admin-vat-row-${countryCode}`);
  }

  rate(countryCode: string): Locator {
    return this.page.getByTestId(`admin-vat-rate-${countryCode}`);
  }

  editButton(countryCode: string): Locator {
    return this.page.getByTestId(`admin-vat-edit-${countryCode}`);
  }

  newError(field: 'countryCode' | 'countryName' | 'rate'): Locator {
    return this.page.getByTestId(`admin-vat-new-${field}-error`);
  }

  /** Opens the inline editor of a row. */
  async edit(countryCode: string): Promise<VatRateEditor> {
    await this.editButton(countryCode).click();
    return new VatRateEditor(this.page, countryCode);
  }

  async addCountry(countryCode: string, countryName: string, rate: string): Promise<void> {
    await this.newCountryCode.fill(countryCode);
    await this.newCountryName.fill(countryName);
    await this.newRate.fill(rate);
    await this.newSaveButton.click();
  }
}

/** Inline editor of one VAT rate row. */
export class VatRateEditor {
  readonly countryCode: Locator;
  readonly countryName: Locator;
  readonly rate: Locator;
  readonly rateError: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page, code: string) {
    const prefix = `admin-vat-edit-${code}`;
    this.countryCode = page.getByTestId(`${prefix}-country-code`);
    this.countryName = page.getByTestId(`${prefix}-country-name`);
    this.rate = page.getByTestId(`${prefix}-rate`);
    this.rateError = page.getByTestId(`${prefix}-rate-error`);
    this.saveButton = page.getByTestId(`${prefix}-save`);
    this.cancelButton = page.getByTestId(`${prefix}-cancel`);
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
