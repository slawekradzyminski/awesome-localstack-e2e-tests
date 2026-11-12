import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** /qr: text to encode, its UTF-8 size, and the generated code. */
export class QrPage extends BasePage {
  readonly text: Locator;
  readonly byteCount: Locator;
  readonly textError: Locator;
  readonly generate: Locator;
  readonly image: Locator;
  readonly result: Locator;
  readonly toast: Locator;

  constructor(page: Page) {
    super(page);
    this.text = page.getByTestId('qr-text-input');
    this.byteCount = page.getByTestId('qr-text-byte-count');
    this.textError = page.getByTestId('qr-text-error');
    this.generate = page.getByTestId('qr-generate-button');
    this.image = page.getByTestId('qr-code-image');
    this.result = page.getByTestId('qr-code-result');
    this.toast = page.getByTestId('toast-description');
  }

  async goto(): Promise<void> {
    await this.page.goto('/qr');
    await this.text.waitFor();
  }

  async generateFor(text: string): Promise<void> {
    await this.text.fill(text);
    await this.generate.click();
  }
}
