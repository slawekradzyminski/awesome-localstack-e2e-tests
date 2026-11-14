import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** /account/notifications: the commerce emails notification-service sent to the customer, newest first. */
export class NotificationsPage extends BasePage {
  readonly root: Locator;
  readonly list: Locator;
  readonly items: Locator;
  readonly empty: Locator;

  constructor(page: Page) {
    super(page);
    this.root = page.getByTestId('notifications-page');
    this.list = page.getByTestId('notifications-list');
    this.items = this.list.getByRole('listitem');
    this.empty = page.getByTestId('notifications-empty');
  }

  async goto(): Promise<void> {
    await this.page.goto('/account/notifications');
    await this.root.waitFor();
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.root.waitFor();
  }

  template(id: string): Locator {
    return this.page.getByTestId(`notification-template-${id}`);
  }

  subject(id: string): Locator {
    return this.page.getByTestId(`notification-subject-${id}`);
  }

  meta(id: string): Locator {
    return this.page.getByTestId(`notification-meta-${id}`);
  }

  status(id: string): Locator {
    return this.page.getByTestId(`notification-status-${id}`);
  }
}
