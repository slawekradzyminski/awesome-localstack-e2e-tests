import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** /admin/webhooks: every user's subscriptions with a username filter. */
export class AdminWebhooksPage extends BasePage {
  readonly root: Locator;
  readonly username: Locator;
  readonly applyButton: Locator;
  readonly clearButton: Locator;
  readonly rows: Locator;
  readonly empty: Locator;

  constructor(page: Page) {
    super(page);
    this.root = page.getByTestId('admin-webhooks');
    this.username = page.getByTestId('admin-webhooks-username');
    this.applyButton = page.getByTestId('admin-webhooks-apply');
    this.clearButton = page.getByTestId('admin-webhooks-clear');
    this.rows = this.root.locator('tbody tr');
    this.empty = page.getByTestId('admin-webhooks-empty');
  }

  /** Navigates only: a customer is redirected away, so there is no list to wait for. */
  async goto(): Promise<void> {
    await this.page.goto('/admin/webhooks');
  }

  row(id: number): AdminWebhookRow {
    return {
      root: this.page.getByTestId(`admin-webhook-row-${id}`),
      username: this.page.getByTestId(`admin-webhook-username-${id}`),
      active: this.page.getByTestId(`admin-webhook-active-${id}`),
    };
  }

  async filterBy(username: string): Promise<void> {
    await this.username.fill(username);
    await this.applyButton.click();
  }

  async clearFilter(): Promise<void> {
    await this.clearButton.click();
  }
}

export interface AdminWebhookRow {
  root: Locator;
  username: Locator;
  active: Locator;
}
