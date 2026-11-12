import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** /: the signed-in home page with its shortcut cards. */
export class HomePage extends BasePage {
  readonly welcome: Locator;
  readonly usersCard: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.welcome = page.getByTestId('home-welcome-title');
    this.usersCard = page.getByTestId('home-users-button');
    this.logoutButton = page.getByTestId('logout-button');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.welcome.waitFor();
  }
}
