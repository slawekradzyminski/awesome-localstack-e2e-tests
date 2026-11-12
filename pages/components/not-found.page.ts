import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** Any path no route matches. */
export class NotFoundPage extends BasePage {
  readonly heading: Locator;
  readonly homeLink: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1, name: 'Page not found' });
    this.homeLink = page.getByTestId('not-found-home-link');
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await this.heading.waitFor();
  }
}
