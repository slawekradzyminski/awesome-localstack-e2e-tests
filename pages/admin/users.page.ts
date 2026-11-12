import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** /users: the admin-only user directory. */
export class UsersPage extends BasePage {
  readonly list: Locator;

  constructor(page: Page) {
    super(page);
    this.list = page.getByTestId('users-list');
  }

  async goto(): Promise<void> {
    await this.page.goto('/users');
    await this.list.waitFor();
  }

  row(username: string): Locator {
    return this.list.locator('[data-testid^="user-item-"]').filter({ hasText: `Username: ${username}` });
  }
}
