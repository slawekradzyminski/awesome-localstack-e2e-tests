import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** /email: the Send Email form with its recipient picker. */
export class EmailPage extends BasePage {
  readonly form: Locator;
  readonly to: Locator;
  readonly subject: Locator;
  readonly message: Locator;
  readonly send: Locator;
  readonly recipientPicker: Locator;

  constructor(page: Page) {
    super(page);
    this.form = page.getByTestId('email-form');
    this.to = page.getByTestId('email-to-input');
    this.subject = page.getByTestId('email-subject-input');
    this.message = page.getByTestId('email-message-input');
    this.send = page.getByTestId('email-submit-button');
    this.recipientPicker = page.getByTestId('users-datalist');
  }

  async goto(): Promise<void> {
    await this.page.goto('/email');
    await this.form.waitFor();
  }

  async sendEmail(email: { to: string; subject: string; message: string }): Promise<void> {
    await this.to.fill(email.to);
    await this.subject.fill(email.subject);
    await this.message.fill(email.message);
    await this.send.click();
  }
}
