import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';
import { WebhookDeliveryDrawer } from './webhook-delivery-drawer.component';
import { WebhookForm } from './webhook-form.component';
import { WebhookInboxes } from './webhook-inboxes.component';
import { WebhookSubscriptionCard } from './webhook-subscription-card.component';

/** /account/webhooks: the signed-in user's subscriptions, the create form, signature help and inboxes. */
export class WebhooksPage extends BasePage {
  readonly heading: Locator;
  readonly subscriptions: Locator;
  readonly subscriptionsEmpty: Locator;
  readonly createForm: WebhookForm;
  readonly createdSecret: Locator;
  readonly createdSecretTitle: Locator;
  readonly createdSecretWarning: Locator;
  readonly createdSecretValue: Locator;
  readonly createdSecretCopyButton: Locator;
  readonly createdSecretCopyStatus: Locator;
  readonly dismissSecretButton: Locator;
  readonly signatureHelp: Locator;
  readonly signatureSnippet: Locator;
  readonly signatureCopyButton: Locator;
  readonly signatureCopyStatus: Locator;
  readonly inboxes: WebhookInboxes;
  readonly drawer: WebhookDeliveryDrawer;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'Webhooks', level: 1 });
    this.subscriptions = page.getByTestId('webhook-subscriptions').locator('article');
    this.subscriptionsEmpty = page.getByTestId('webhook-subscriptions-empty');
    this.createForm = new WebhookForm(page, 'webhook-create');
    this.createdSecret = page.getByTestId('webhook-created-secret');
    this.createdSecretTitle = this.createdSecret.getByRole('heading');
    this.createdSecretWarning = page.getByTestId('webhook-created-secret-warning');
    this.createdSecretValue = page.getByTestId('webhook-created-secret-value');
    this.createdSecretCopyButton = page.getByTestId('webhook-created-secret-copy');
    this.createdSecretCopyStatus = page.getByTestId('webhook-created-secret-copy-status');
    this.dismissSecretButton = page.getByTestId('webhook-created-secret-dismiss');
    this.signatureHelp = page.getByTestId('webhook-signature-help');
    this.signatureSnippet = page.getByTestId('webhook-signature-snippet');
    this.signatureCopyButton = page.getByTestId('webhook-signature-copy');
    this.signatureCopyStatus = page.getByTestId('webhook-signature-copy-status');
    this.inboxes = new WebhookInboxes(page);
    this.drawer = new WebhookDeliveryDrawer(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/account/webhooks');
    await this.heading.waitFor();
  }

  subscription(id: number): WebhookSubscriptionCard {
    return new WebhookSubscriptionCard(this.page, id);
  }

  async copyCreatedSecret(): Promise<void> {
    await this.createdSecretCopyButton.click();
  }

  async dismissSecret(): Promise<void> {
    await this.dismissSecretButton.click();
  }

  async copySignatureSnippet(): Promise<void> {
    await this.signatureCopyButton.click();
  }
}
