import type { Locator, Page } from '@playwright/test';
import { WebhookForm } from './webhook-form.component';

/** One subscription on /account/webhooks (testids webhook-<id>-*), with its deliveries table. */
export class WebhookSubscriptionCard {
  readonly root: Locator;
  readonly url: Locator;
  readonly description: Locator;
  readonly events: Locator;
  readonly active: Locator;
  readonly failures: Locator;
  readonly sendTestButton: Locator;
  readonly testResult: Locator;
  readonly testStatus: Locator;
  readonly toggleDeliveriesButton: Locator;
  readonly editButton: Locator;
  readonly rotateButton: Locator;
  readonly deleteButton: Locator;
  readonly newSecretValue: Locator;
  readonly editDialog: Locator;
  readonly editForm: WebhookForm;
  readonly confirmDialog: Locator;
  readonly confirmButton: Locator;
  readonly deliveryRows: Locator;
  readonly deliveriesEmpty: Locator;
  readonly deliveriesStatusFilter: Locator;

  constructor(private readonly page: Page, readonly id: number) {
    const prefix = `webhook-${id}`;
    this.root = page.getByTestId(prefix);
    this.url = page.getByTestId(`${prefix}-url`);
    this.description = page.getByTestId(`${prefix}-description`);
    this.events = page.getByTestId(`${prefix}-events`);
    this.active = page.getByTestId(`${prefix}-active`);
    this.failures = page.getByTestId(`${prefix}-failures`);
    this.sendTestButton = page.getByTestId(`${prefix}-test`);
    this.testResult = page.getByTestId(`${prefix}-test-result`);
    this.testStatus = page.getByTestId(`${prefix}-test-status`);
    this.toggleDeliveriesButton = page.getByTestId(`${prefix}-toggle-deliveries`);
    this.editButton = page.getByTestId(`${prefix}-edit`);
    this.rotateButton = page.getByTestId(`${prefix}-rotate`);
    this.deleteButton = page.getByTestId(`${prefix}-delete`);
    this.newSecretValue = page.getByTestId(`${prefix}-secret-value`);
    this.editDialog = page.getByTestId(`${prefix}-edit-dialog`);
    this.editForm = new WebhookForm(page, `${prefix}-edit`);
    this.confirmDialog = page.getByTestId(`${prefix}-confirm`);
    this.confirmButton = page.getByTestId(`${prefix}-confirm-confirm`);
    this.deliveryRows = page.getByTestId(`webhook-deliveries-${id}`).locator('tbody tr');
    this.deliveriesEmpty = page.getByTestId(`webhook-deliveries-${id}-empty`);
    this.deliveriesStatusFilter = page.getByTestId(`webhook-deliveries-${id}-status`);
  }

  delivery(deliveryId: string): Locator {
    return this.page.getByTestId(`webhook-delivery-${deliveryId}`);
  }

  deliveryStatus(deliveryId: string): Locator {
    return this.page.getByTestId(`webhook-delivery-status-${deliveryId}`);
  }

  deliveryCode(deliveryId: string): Locator {
    return this.page.getByTestId(`webhook-delivery-code-${deliveryId}`);
  }

  async sendTest(): Promise<void> {
    await this.sendTestButton.click();
  }

  async toggleDeliveries(): Promise<void> {
    await this.toggleDeliveriesButton.click();
  }

  async filterDeliveries(status: string): Promise<void> {
    await this.deliveriesStatusFilter.selectOption(status);
  }

  async openDelivery(deliveryId: string): Promise<void> {
    await this.page.getByTestId(`webhook-delivery-details-${deliveryId}`).click();
  }

  async edit(): Promise<void> {
    await this.editButton.click();
  }

  async rotateSecret(): Promise<void> {
    await this.rotateButton.click();
  }

  async delete(): Promise<void> {
    await this.deleteButton.click();
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click();
  }
}
