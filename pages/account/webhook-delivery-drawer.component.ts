import type { Locator, Page } from '@playwright/test';

/** The "Delivery details" drawer opened from a deliveries table. */
export class WebhookDeliveryDrawer {
  readonly dialog: Locator;
  readonly status: Locator;
  readonly code: Locator;
  readonly attempts: Locator;
  readonly eventId: Locator;
  readonly headers: Locator;
  readonly payload: Locator;
  readonly response: Locator;
  readonly lastError: Locator;
  readonly redeliverButton: Locator;
  readonly result: Locator;
  readonly closeButton: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Delivery details' });
    this.status = page.getByTestId('webhook-delivery-drawer-status');
    this.code = page.getByTestId('webhook-delivery-drawer-code');
    this.attempts = page.getByTestId('webhook-delivery-drawer-attempts');
    this.eventId = page.getByTestId('webhook-delivery-drawer-event-id');
    this.headers = page.getByTestId('webhook-delivery-drawer-headers');
    this.payload = page.getByTestId('webhook-delivery-drawer-payload');
    this.response = page.getByTestId('webhook-delivery-drawer-response');
    this.lastError = page.getByTestId('webhook-delivery-drawer-last-error');
    this.redeliverButton = page.getByTestId('webhook-delivery-drawer-redeliver');
    this.result = page.getByTestId('webhook-delivery-drawer-result');
    this.closeButton = page.getByTestId('webhook-delivery-drawer-close');
  }

  /** The value cell of one request header. */
  header(name: string): Locator {
    return this.headers.getByRole('row').filter({ has: this.page.getByRole('rowheader', { name, exact: true }) }).getByRole('cell');
  }

  async redeliver(): Promise<void> {
    await this.redeliverButton.click();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }
}
