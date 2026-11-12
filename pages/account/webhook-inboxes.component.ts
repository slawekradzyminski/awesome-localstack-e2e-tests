import type { Locator, Page } from '@playwright/test';

/** "Built-in inboxes" section of /account/webhooks. */
export class WebhookInboxes {
  readonly root: Locator;
  readonly createButton: Locator;
  readonly count: Locator;
  readonly empty: Locator;
  readonly error: Locator;
  readonly urls: Locator;
  readonly confirmDeleteButton: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId('webhook-inboxes');
    this.createButton = page.getByTestId('webhook-inbox-create');
    this.count = page.getByTestId('webhook-inbox-count');
    this.empty = page.getByTestId('webhook-inboxes-empty');
    this.error = page.getByTestId('webhook-inbox-error');
    this.urls = this.root.locator('[data-testid^="webhook-inbox-url-"]');
    this.confirmDeleteButton = page.getByTestId('webhook-inbox-confirm-confirm');
  }

  inbox(token: string): WebhookInboxItem {
    const page = this.page;
    return {
      root: page.getByTestId(`webhook-inbox-${token}`),
      url: page.getByTestId(`webhook-inbox-url-${token}`),
      copyButton: page.getByTestId(`webhook-inbox-copy-${token}`),
      useAsUrlButton: page.getByTestId(`webhook-inbox-use-${token}`),
      toggleRequestsButton: page.getByTestId(`webhook-inbox-toggle-${token}`),
      deleteButton: page.getByTestId(`webhook-inbox-delete-${token}`),
      requestsEmpty: page.getByTestId(`webhook-inbox-requests-${token}-empty`),
      requests: page.getByTestId(`webhook-inbox-requests-${token}`).locator('[data-testid^="webhook-inbox-request-event-"]'),
    };
  }

  request(id: number): WebhookInboxRequestItem {
    const page = this.page;
    return {
      event: page.getByTestId(`webhook-inbox-request-event-${id}`),
      signature: page.getByTestId(`webhook-inbox-request-signature-${id}`),
      body: page.getByTestId(`webhook-inbox-request-body-${id}`),
      headers: page.getByTestId(`webhook-inbox-request-headers-${id}`),
    };
  }

  async createInbox(): Promise<void> {
    await this.createButton.click();
  }

  async copyUrl(token: string): Promise<void> {
    await this.inbox(token).copyButton.click();
  }

  async useAsUrl(token: string): Promise<void> {
    await this.inbox(token).useAsUrlButton.click();
  }

  async toggleRequests(token: string): Promise<void> {
    await this.inbox(token).toggleRequestsButton.click();
  }

  async deleteInbox(token: string): Promise<void> {
    await this.inbox(token).deleteButton.click();
    await this.confirmDeleteButton.click();
  }
}

export interface WebhookInboxItem {
  root: Locator;
  url: Locator;
  copyButton: Locator;
  useAsUrlButton: Locator;
  toggleRequestsButton: Locator;
  deleteButton: Locator;
  requestsEmpty: Locator;
  requests: Locator;
}

export interface WebhookInboxRequestItem {
  event: Locator;
  signature: Locator;
  body: Locator;
  headers: Locator;
}
