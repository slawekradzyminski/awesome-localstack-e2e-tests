import type { Locator, Page } from '@playwright/test';

export interface WebhookFormValues {
  url?: string;
  events?: string[];
  description?: string;
}

/** WebhookForm: the create form (prefix webhook-create) or a subscription's edit dialog (prefix webhook-<id>-edit). */
export class WebhookForm {
  readonly url: Locator;
  readonly urlError: Locator;
  readonly eventsError: Locator;
  readonly description: Locator;
  readonly active: Locator;
  readonly formError: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(private readonly page: Page, private readonly prefix: string) {
    this.url = page.getByTestId(`${prefix}-url`);
    this.urlError = page.getByTestId(`${prefix}-url-error`);
    this.eventsError = page.getByTestId(`${prefix}-events-error`);
    this.description = page.getByTestId(`${prefix}-description`);
    this.active = page.getByTestId(`${prefix}-active`);
    this.formError = page.getByTestId(`${prefix}-error`);
    this.submitButton = page.getByTestId(`${prefix}-submit`);
    this.cancelButton = page.getByTestId(`${prefix}-cancel`);
  }

  event(name: string): Locator {
    return this.page.getByTestId(`${this.prefix}-event-${name}`);
  }

  /** Fills the given fields and ticks the given events; other fields keep their value. */
  async fill(values: WebhookFormValues): Promise<void> {
    if (values.url !== undefined) await this.url.fill(values.url);
    for (const event of values.events ?? []) await this.event(event).check();
    if (values.description !== undefined) await this.description.fill(values.description);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
