import type { Page } from '@playwright/test';

/**
 * A page the browser can open by URL.
 *
 * Page objects expose locators as readonly fields built in the constructor and actions as
 * intent-named methods. They assert nothing, except in methods whose name starts with `expect`.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Opens the page and waits until it shows its data. */
  abstract goto(...args: never[]): Promise<void>;
}
