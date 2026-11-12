import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** /admin/currencies: every currency's rate to USD, inline editors and the new-currency form. */
export class AdminCurrenciesPage extends BasePage {
  readonly heading: Locator;
  readonly rows: Locator;
  readonly baseCurrencyNote: Locator;
  readonly newCode: Locator;
  readonly newName: Locator;
  readonly newSymbol: Locator;
  readonly newRate: Locator;
  readonly newSaveButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'Currencies' });
    this.rows = page.locator('[data-testid^="admin-currency-row-"]');
    this.baseCurrencyNote = page.getByText('Base currency, locked to 1.');
    this.newCode = page.getByTestId('admin-currency-new-code');
    this.newName = page.getByTestId('admin-currency-new-name');
    this.newSymbol = page.getByTestId('admin-currency-new-symbol');
    this.newRate = page.getByTestId('admin-currency-new-rate');
    this.newSaveButton = page.getByTestId('admin-currency-new-save');
  }

  /** Opens the page and waits for the list: a save made while the first load is in flight is lost (bugs/BUG-TAX-01). */
  async goto(): Promise<void> {
    await this.open();
    await this.rows.first().waitFor();
  }

  /** Navigates without waiting for the list. */
  async open(): Promise<void> {
    await this.page.goto('/admin/currencies');
  }

  row(code: string): Locator {
    return this.page.getByTestId(`admin-currency-row-${code}`);
  }

  baseBadge(code: string): Locator {
    return this.row(code).getByTestId('admin-currency-base');
  }

  rate(code: string): Locator {
    return this.page.getByTestId(`admin-currency-rate-${code}`);
  }

  editButton(code: string): Locator {
    return this.page.getByTestId(`admin-currency-edit-${code}`);
  }

  newError(field: 'code' | 'name' | 'symbol' | 'rateToUsd'): Locator {
    return this.page.getByTestId(`admin-currency-new-${field}-error`);
  }

  /** Opens the inline editor of a row. */
  async edit(code: string): Promise<CurrencyEditor> {
    await this.editButton(code).click();
    return new CurrencyEditor(this.page, code);
  }

  async addCurrency(code: string, name: string, symbol: string, rateToUsd: string): Promise<void> {
    await this.newCode.fill(code);
    await this.newName.fill(name);
    await this.newSymbol.fill(symbol);
    await this.newRate.fill(rateToUsd);
    await this.newSaveButton.click();
  }
}

/** Inline editor of one currency row. */
export class CurrencyEditor {
  readonly code: Locator;
  readonly name: Locator;
  readonly symbol: Locator;
  readonly rate: Locator;
  readonly rateError: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page, code: string) {
    const prefix = `admin-currency-edit-${code}`;
    this.code = page.getByTestId(`${prefix}-code`);
    this.name = page.getByTestId(`${prefix}-name`);
    this.symbol = page.getByTestId(`${prefix}-symbol`);
    this.rate = page.getByTestId(`${prefix}-rate`);
    this.rateError = page.getByTestId(`${prefix}-rateToUsd-error`);
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
