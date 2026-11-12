import type { Locator, Page } from '@playwright/test';

/** Display currency in the navigation bar. The choice is a per-browser preference kept in localStorage. */
export class CurrencySelector {
  readonly select: Locator;

  constructor(page: Page) {
    this.select = page.getByTestId('currency-selector');
  }

  option(code: string): Locator {
    return this.select.locator(`option[value="${code}"]`);
  }

  async choose(code: string): Promise<void> {
    await this.select.selectOption(code);
  }
}
